-- Permission helpers, organisation bootstrap, payroll math, and approvals.
-- These functions are the security boundary. The UI is not.

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and is_platform_admin
      and status = 'active'
      and deleted_at is null
  );
$$;

create or replace function private.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function private.is_super_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.organization_id = p_org
      and ur.status = 'active'
      and r.code = 'super_admin'
      and (ur.expires_at is null or ur.expires_at > now())
  );
$$;

create or replace function private.has_permission(p_org uuid, p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      private.is_super_admin(p_org)
      or exists (
        select 1
        from user_roles ur
        join role_permissions rp on rp.role_id = ur.role_id
        join permissions p on p.id = rp.permission_id
        where ur.user_id = auth.uid()
          and ur.organization_id = p_org
          and ur.status = 'active'
          and (ur.expires_at is null or ur.expires_at > now())
          and p.code = p_code
      )
    );
$$;

create or replace function private.has_org_wide(p_org uuid, p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_super_admin(p_org)
    or exists (
      select 1
      from user_roles ur
      join roles r on r.id = ur.role_id
      join role_permissions rp on rp.role_id = ur.role_id
      join permissions p on p.id = rp.permission_id
      where ur.user_id = auth.uid()
        and ur.organization_id = p_org
        and ur.status = 'active'
        and ur.scope_type = 'organization'
        and r.code not in ('employee', 'viewer')
        and (ur.expires_at is null or ur.expires_at > now())
        and p.code = p_code
    );
$$;

create or replace function private.employee_in_scope(p_employee uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from employees e
    join user_roles ur
      on ur.user_id = auth.uid()
     and ur.organization_id = e.organization_id
     and ur.status = 'active'
     and (ur.expires_at is null or ur.expires_at > now())
    where e.id = p_employee
      and (
        ur.scope_type = 'organization'
        or (ur.scope_type = 'branch' and ur.scope_id = e.branch_id)
        or (ur.scope_type = 'department' and ur.scope_id = e.department_id)
        or (ur.scope_type = 'team' and ur.scope_id = e.team_id)
        or (ur.scope_type = 'self' and e.profile_id = auth.uid())
        or (
          ur.scope_type = 'direct_reports'
          and e.supervisor_id in (
            select m.id from employees m
            where m.profile_id = auth.uid()
              and m.organization_id = e.organization_id
              and m.deleted_at is null
          )
        )
      )
  );
$$;

create or replace function private.can_read_employee(p_employee uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from employees e
    where e.id = p_employee
      and e.deleted_at is null
      and (
        e.profile_id = auth.uid()
        or private.has_permission(e.organization_id, 'directory.view')
        or private.has_org_wide(e.organization_id, 'employee.view')
        or (
          private.has_permission(e.organization_id, 'employee.view')
          and private.employee_in_scope(e.id)
        )
      )
  );
$$;

create or replace function private.can_access_employee_row(
  p_employee uuid,
  p_permission text,
  p_include_self boolean
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from employees e
    where e.id = p_employee
      and e.deleted_at is null
      and (
        (p_include_self and e.profile_id = auth.uid())
        or private.has_org_wide(e.organization_id, p_permission)
        or (
          private.has_permission(e.organization_id, p_permission)
          and private.employee_in_scope(e.id)
        )
      )
  );
$$;

create or replace function private.copy_role_templates(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into roles (organization_id, code, name, description, is_system)
  select p_org, seed.code, seed.name, seed.description, true
  from (
    values
      ('super_admin', 'Super Administrator', 'Full access. This role cannot be locked out of a permission.'),
      ('hr_admin', 'HR Administrator', 'Runs the employee lifecycle, without executing payroll.'),
      ('hr_officer', 'HR Officer', 'Maintains employee records, documents, and day-to-day HR cases.'),
      ('payroll_admin', 'Payroll Administrator', 'Configures and runs payroll.'),
      ('finance_officer', 'Finance Officer', 'Reviews payroll, pays expenses, and reads bank details.'),
      ('recruiter', 'Recruiter', 'Manages vacancies, candidates, and offers.'),
      ('department_head', 'Department Head', 'Manages one department. Assign this role with a department scope.'),
      ('line_manager', 'Line Manager', 'Manages direct reports.'),
      ('supervisor', 'Supervisor', 'Reviews attendance and leave for direct reports.'),
      ('employee', 'Employee', 'Self-service access to the signed-in employee only.'),
      ('executive', 'Executive', 'Company-wide workforce and payroll oversight.'),
      ('auditor', 'Auditor', 'Read-only access to permitted records and the audit trail.'),
      ('it_admin', 'IT Administrator', 'User access, assets, and onboarding technology tasks.'),
      ('viewer', 'Viewer', 'Directory and organisation chart only.')
  ) as seed(code, name, description)
  on conflict (organization_id, code) do nothing;

  insert into role_permissions (role_id, permission_id)
  select r.id, p.id
  from role_permission_templates t
  join roles r on r.organization_id = p_org and r.code = t.role_code
  join permissions p on p.code = t.permission_code
  on conflict do nothing;
end;
$$;

create or replace function private.seed_org_defaults(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org organizations%rowtype;
  v_leave uuid;
  v_expense uuid;
  v_salary uuid;
  v_recruitment uuid;
  v_loan uuid;
begin
  select * into v_org from organizations where id = p_org;

  insert into working_days (organization_id, weekday, is_working, start_time, end_time)
  select p_org, day.weekday, day.weekday between 1 and 5, '08:00', '17:00'
  from generate_series(0, 6) as day(weekday)
  on conflict do nothing;

  insert into number_sequences (organization_id, sequence_key, prefix, next_value, padding)
  values
    (p_org, 'employee', v_org.employee_number_prefix, 1, v_org.employee_number_padding),
    (p_org, 'document', v_org.document_number_prefix, 1, 5),
    (p_org, 'payroll', v_org.payroll_number_prefix, 1, 5),
    (p_org, 'letter', 'LTR-', 1, 5)
  on conflict do nothing;

  perform private.copy_role_templates(p_org);

  insert into approval_workflows (organization_id, code, name, entity_type)
  values
    (p_org, 'leave', 'Leave request', 'leave_request'),
    (p_org, 'expense', 'Expense claim', 'expense_claim'),
    (p_org, 'salary_adjustment', 'Salary adjustment', 'salary_history'),
    (p_org, 'recruitment', 'Job requisition', 'job_requisition'),
    (p_org, 'loan', 'Employee loan', 'employee_loan')
  on conflict (organization_id, code) do nothing;

  select id into v_leave from approval_workflows where organization_id = p_org and code = 'leave';
  select id into v_expense from approval_workflows where organization_id = p_org and code = 'expense';
  select id into v_salary from approval_workflows where organization_id = p_org and code = 'salary_adjustment';
  select id into v_recruitment from approval_workflows where organization_id = p_org and code = 'recruitment';
  select id into v_loan from approval_workflows where organization_id = p_org and code = 'loan';

  insert into approval_steps (workflow_id, step_order, approver_kind, role_code, permission_code)
  values
    (v_leave, 1, 'direct_manager', null, null),
    (v_leave, 2, 'org_permission', null, 'leave.approve'),
    (v_expense, 1, 'direct_manager', null, null),
    (v_expense, 2, 'org_permission', null, 'expenses.pay'),
    (v_salary, 1, 'direct_manager', null, null),
    (v_salary, 2, 'role', 'hr_admin', null),
    (v_salary, 3, 'role', 'finance_officer', null),
    (v_salary, 4, 'role', 'executive', null),
    (v_recruitment, 1, 'direct_manager', null, null),
    (v_recruitment, 2, 'role', 'hr_admin', null),
    (v_recruitment, 3, 'role', 'executive', null),
    (v_loan, 1, 'role', 'hr_admin', null),
    (v_loan, 2, 'role', 'finance_officer', null)
  on conflict (workflow_id, step_order) do nothing;

  insert into leave_types (organization_id, code, name, paid, requires_document, gender_restriction)
  values
    (p_org, 'annual', 'Annual leave', true, false, 'any'),
    (p_org, 'sick', 'Sick leave', true, true, 'any'),
    (p_org, 'maternity', 'Maternity leave', true, true, 'female'),
    (p_org, 'paternity', 'Paternity leave', true, true, 'male'),
    (p_org, 'compassionate', 'Compassionate leave', true, true, 'any'),
    (p_org, 'study', 'Study leave', true, true, 'any'),
    (p_org, 'unpaid', 'Unpaid leave', false, false, 'any'),
    (p_org, 'marriage', 'Marriage leave', true, true, 'any'),
    (p_org, 'official', 'Official duty', true, false, 'any')
  on conflict (organization_id, code) do nothing;

  insert into earning_types (organization_id, code, name, taxable)
  values
    (p_org, 'basic', 'Basic salary', true),
    (p_org, 'housing', 'Housing allowance', true),
    (p_org, 'transport', 'Transport allowance', true),
    (p_org, 'airtime', 'Airtime allowance', true),
    (p_org, 'lunch', 'Lunch allowance', false),
    (p_org, 'responsibility', 'Responsibility allowance', true),
    (p_org, 'overtime', 'Overtime', true),
    (p_org, 'bonus', 'Bonus', true),
    (p_org, 'commission', 'Commission', true),
    (p_org, 'acting', 'Acting allowance', true)
  on conflict (organization_id, code) do nothing;

  insert into deduction_types (organization_id, code, name, category)
  values
    (p_org, 'paye', 'Income tax', 'statutory'),
    (p_org, 'social_security', 'Social security', 'statutory'),
    (p_org, 'pension', 'Pension', 'statutory'),
    (p_org, 'insurance', 'Insurance', 'voluntary'),
    (p_org, 'loan', 'Loan repayment', 'loan'),
    (p_org, 'advance', 'Salary advance', 'loan'),
    (p_org, 'absence', 'Absence deduction', 'absence')
  on conflict (organization_id, code) do nothing;

  insert into letter_templates (organization_id, code, name, body)
  values
    (p_org, 'appointment', 'Appointment letter',
      E'Dear {{employee_name}},\n\nWe appoint you as {{job_title}} in {{department}}, effective {{effective_date}}.\n\nBasic salary: {{salary}}.\n'),
    (p_org, 'confirmation', 'Confirmation letter',
      E'Dear {{employee_name}},\n\nYour appointment as {{job_title}} is confirmed with effect from {{effective_date}}.\n'),
    (p_org, 'employment_verification', 'Employment verification',
      E'This confirms that {{employee_name}} ({{employee_number}}) is employed as {{job_title}} in {{department}}.\n')
  on conflict (organization_id, code) do nothing;
end;
$$;

create or replace function private.add_super_admin(p_org uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role uuid;
begin
  select id into v_role from roles where organization_id = p_org and code = 'super_admin';
  insert into organization_members (organization_id, user_id, status, is_primary, created_by)
  values (p_org, p_user, 'active', true, p_user)
  on conflict (organization_id, user_id) do update set status = 'active';

  insert into user_roles (organization_id, user_id, role_id, scope_type, status, granted_by)
  select p_org, p_user, v_role, 'organization', 'active', p_user
  where not exists (
    select 1 from user_roles
    where organization_id = p_org and user_id = p_user and role_id = v_role and scope_type = 'organization'
  );
end;
$$;

create or replace function public.bootstrap_organization(
  p_legal_name text,
  p_country_code text,
  p_currency_code text,
  p_timezone text,
  p_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  perform pg_advisory_xact_lock(874213);

  if exists (select 1 from organizations where deleted_at is null) then
    raise exception 'An organization already exists. Ask an administrator for access.';
  end if;

  if char_length(coalesce(p_legal_name, '')) < 2 then
    raise exception 'Enter the legal company name';
  end if;

  insert into organizations (
    legal_name, country_code, currency_code, timezone, created_by
  ) values (
    trim(p_legal_name),
    upper(trim(p_country_code)),
    upper(trim(p_currency_code)),
    trim(p_timezone),
    v_user
  )
  returning id into v_org;

  perform private.seed_org_defaults(v_org);
  perform private.add_super_admin(v_org, v_user);

  perform set_config('app.allow_profile_admin', '1', true);
  update profiles
  set
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
    active_organization_id = v_org,
    is_platform_admin = true,
    status = 'active'
  where id = v_user;

  insert into notifications (organization_id, recipient_id, title, body, channel, status, module)
  values (
    v_org,
    v_user,
    'Workspace ready',
    'Your organisation is set up. Add a branch, invite the HR team, and confirm the work week.',
    'in_app',
    'sent',
    'organization'
  );

  return v_org;
end;
$$;

create or replace function public.create_organization(
  p_legal_name text,
  p_country_code text,
  p_currency_code text,
  p_timezone text,
  p_parent_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null or not private.is_platform_admin() then
    raise exception 'Only the platform administrator can create another company';
  end if;

  if p_parent_id is not null and not exists (select 1 from organizations where id = p_parent_id and deleted_at is null) then
    raise exception 'Parent company was not found';
  end if;

  insert into organizations (
    legal_name, country_code, currency_code, timezone, parent_organization_id,
    org_type, created_by
  ) values (
    trim(p_legal_name),
    upper(trim(p_country_code)),
    upper(trim(p_currency_code)),
    trim(p_timezone),
    p_parent_id,
    case when p_parent_id is null then 'company' else 'subsidiary' end,
    v_user
  )
  returning id into v_org;

  perform private.seed_org_defaults(v_org);
  perform private.add_super_admin(v_org, v_user);
  return v_org;
end;
$$;

create or replace function public.switch_organization(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not private.is_org_member(p_org) then
    raise exception 'You are not a member of that organization';
  end if;
  perform set_config('app.allow_profile_admin', '1', true);
  update profiles set active_organization_id = p_org where id = auth.uid();
end;
$$;

create or replace function public.setup_available()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from organizations where deleted_at is null);
$$;

create or replace function public.current_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_org organizations%rowtype;
  v_permissions jsonb := '[]'::jsonb;
  v_roles jsonb := '[]'::jsonb;
  v_unread integer := 0;
begin
  if auth.uid() is null then
    return null;
  end if;

  select * into v_profile from profiles where id = auth.uid();
  if not found then
    return null;
  end if;

  if v_profile.active_organization_id is not null then
    select * into v_org
    from organizations
    where id = v_profile.active_organization_id
      and deleted_at is null;
  end if;

  if v_org.id is not null then
    if private.is_super_admin(v_org.id) then
      select coalesce(jsonb_agg(code order by code), '[]'::jsonb)
      into v_permissions
      from permissions;
    else
      select coalesce(jsonb_agg(distinct p.code order by p.code), '[]'::jsonb)
      into v_permissions
      from user_roles ur
      join role_permissions rp on rp.role_id = ur.role_id
      join permissions p on p.id = rp.permission_id
      where ur.user_id = auth.uid()
        and ur.organization_id = v_org.id
        and ur.status = 'active'
        and (ur.expires_at is null or ur.expires_at > now());
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', ur.id,
      'role_id', r.id,
      'code', r.code,
      'name', r.name,
      'scope_type', ur.scope_type,
      'scope_id', ur.scope_id
    )), '[]'::jsonb)
    into v_roles
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.organization_id = v_org.id
      and ur.status = 'active';
  end if;

  select count(*)::integer into v_unread
  from notifications
  where recipient_id = auth.uid()
    and channel = 'in_app'
    and read_at is null
    and status in ('pending', 'sent');

  return jsonb_build_object(
    'user_id', v_profile.id,
    'email', v_profile.email,
    'full_name', v_profile.full_name,
    'phone', v_profile.phone,
    'avatar_path', v_profile.avatar_path,
    'is_platform_admin', v_profile.is_platform_admin,
    'mfa_required', v_profile.mfa_required or coalesce(v_org.mfa_required, false),
    'active_organization_id', v_org.id,
    'permissions', v_permissions,
    'roles', v_roles,
    'unread_notifications', v_unread,
    'organization', case when v_org.id is null then null else jsonb_build_object(
      'id', v_org.id,
      'legal_name', v_org.legal_name,
      'trading_name', v_org.trading_name,
      'org_type', v_org.org_type,
      'registration_number', v_org.registration_number,
      'tax_number', v_org.tax_number,
      'logo_path', v_org.logo_path,
      'email', v_org.email,
      'phone', v_org.phone,
      'website', v_org.website,
      'address_line1', v_org.address_line1,
      'address_line2', v_org.address_line2,
      'city', v_org.city,
      'state_region', v_org.state_region,
      'postal_code', v_org.postal_code,
      'country_code', v_org.country_code,
      'currency_code', v_org.currency_code,
      'timezone', v_org.timezone,
      'date_format', v_org.date_format,
      'time_format', v_org.time_format,
      'fiscal_year_start_month', v_org.fiscal_year_start_month,
      'leave_year_start_month', v_org.leave_year_start_month,
      'payroll_frequency', v_org.payroll_frequency,
      'working_hours_per_day', v_org.working_hours_per_day,
      'week_start', v_org.week_start,
      'primary_color', v_org.primary_color,
      'accent_color', v_org.accent_color,
      'employee_number_prefix', v_org.employee_number_prefix,
      'employee_number_padding', v_org.employee_number_padding,
      'document_number_prefix', v_org.document_number_prefix,
      'payroll_number_prefix', v_org.payroll_number_prefix,
      'mfa_required', v_org.mfa_required,
      'status', v_org.status
    ) end
  );
end;
$$;
