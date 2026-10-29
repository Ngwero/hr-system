-- Numbering, statutory calculations, leave days, approvals, and role assignment.

create or replace function public.allocate_number(p_org uuid, p_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  rec number_sequences%rowtype;
begin
  if auth.uid() is null or not private.is_org_member(p_org) then
    raise exception 'Not allowed to allocate a number';
  end if;

  if not (
    private.has_permission(p_org, 'organization.manage')
    or private.has_permission(p_org, 'employee.create')
    or private.has_permission(p_org, 'payroll.run')
    or private.has_permission(p_org, 'documents.manage')
    or private.has_permission(p_org, 'letters.generate')
  ) then
    raise exception 'Not allowed to allocate a number';
  end if;

  update number_sequences
  set next_value = next_value + 1
  where organization_id = p_org
    and sequence_key = p_key
  returning * into rec;

  if not found then
    raise exception 'Number sequence % is not configured', p_key;
  end if;

  return rec.prefix || lpad((rec.next_value - 1)::text, rec.padding, '0');
end;
$$;

create or replace function public.calculate_progressive_tax(p_rule_set_id uuid, p_amount numeric)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  b record;
  slice numeric;
  tax numeric := 0;
begin
  select organization_id into v_org
  from statutory_rule_sets
  where id = p_rule_set_id;

  if v_org is null then
    raise exception 'Statutory rule set was not found';
  end if;

  if not (
    private.has_permission(v_org, 'payroll.view')
    or private.has_permission(v_org, 'payroll.run')
    or private.has_permission(v_org, 'payroll.configure')
  ) then
    raise exception 'Not allowed to calculate statutory amounts';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    return 0;
  end if;

  for b in
    select from_amount, to_amount, rate
    from tax_brackets
    where rule_set_id = p_rule_set_id
    order by band_order
  loop
    slice := least(p_amount, coalesce(b.to_amount, p_amount)) - b.from_amount;
    if slice > 0 then
      tax := tax + (slice * b.rate);
    end if;
  end loop;

  return round(tax, 2);
end;
$$;

create or replace function public.calculate_statutory_amount(p_rule_set_id uuid, p_base numeric)
returns table(employee_amount numeric, employer_amount numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rule statutory_rule_sets%rowtype;
  chargeable numeric;
begin
  select * into rule from statutory_rule_sets where id = p_rule_set_id;
  if not found then
    raise exception 'Statutory rule set was not found';
  end if;

  if not (
    private.has_permission(rule.organization_id, 'payroll.view')
    or private.has_permission(rule.organization_id, 'payroll.run')
    or private.has_permission(rule.organization_id, 'payroll.configure')
  ) then
    raise exception 'Not allowed to calculate statutory amounts';
  end if;

  if rule.calculation_method = 'progressive_bracket' then
    employee_amount := public.calculate_progressive_tax(p_rule_set_id, p_base);
    employer_amount := round(coalesce(p_base, 0) * coalesce(rule.employer_rate, 0), 2);
    return next;
    return;
  end if;

  if rule.calculation_method = 'fixed_amount' then
    employee_amount := round(coalesce(rule.fixed_amount, 0), 2);
    employer_amount := round(coalesce((rule.config->>'employer_fixed')::numeric, 0), 2);
    return next;
    return;
  end if;

  chargeable := greatest(
    least(coalesce(p_base, 0), coalesce(rule.ceiling_amount, coalesce(p_base, 0)))
      - coalesce(rule.threshold_amount, 0),
    0
  );
  employee_amount := round(chargeable * coalesce(rule.employee_rate, 0), 2);
  employer_amount := round(chargeable * coalesce(rule.employer_rate, 0), 2);
  return next;
end;
$$;

create or replace function public.statutory_rule_snapshot(p_rule_set_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rule statutory_rule_sets%rowtype;
  brackets jsonb;
begin
  select * into rule from statutory_rule_sets where id = p_rule_set_id;
  if not found then
    raise exception 'Statutory rule set was not found';
  end if;

  if not (
    private.has_permission(rule.organization_id, 'payroll.run')
    or private.has_permission(rule.organization_id, 'payroll.configure')
  ) then
    raise exception 'Not allowed to snapshot statutory rules';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'band_order', band_order,
    'from_amount', from_amount,
    'to_amount', to_amount,
    'rate', rate
  ) order by band_order), '[]'::jsonb)
  into brackets
  from tax_brackets
  where rule_set_id = p_rule_set_id;

  return jsonb_build_object(
    'id', rule.id,
    'name', rule.name,
    'category', rule.category,
    'tax_year', rule.tax_year,
    'effective_from', rule.effective_from,
    'effective_to', rule.effective_to,
    'calculation_method', rule.calculation_method,
    'employee_rate', rule.employee_rate,
    'employer_rate', rule.employer_rate,
    'threshold_amount', rule.threshold_amount,
    'ceiling_amount', rule.ceiling_amount,
    'fixed_amount', rule.fixed_amount,
    'contribution_base', rule.contribution_base,
    'brackets', brackets
  );
end;
$$;

create or replace function public.reopen_payroll(p_run uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec payroll_runs%rowtype;
begin
  select * into rec from payroll_runs where id = p_run;
  if not found then
    raise exception 'Payroll run was not found';
  end if;

  if not private.has_permission(rec.organization_id, 'payroll.reopen') then
    raise exception 'You are not allowed to reopen payroll';
  end if;

  if rec.status = 'paid' then
    raise exception 'A paid payroll run cannot be reopened';
  end if;

  if rec.status not in ('approved', 'locked') then
    raise exception 'Only an approved or locked run can be reopened';
  end if;

  if char_length(coalesce(trim(p_reason), '')) < 8 then
    raise exception 'Enter a reason of at least 8 characters';
  end if;

  insert into payroll_reopen_events (
    organization_id, payroll_run_id, previous_status, reason, reopened_by
  ) values (
    rec.organization_id, rec.id, rec.status, trim(p_reason), auth.uid()
  );

  perform set_config('app.payroll_reopen', '1', true);
  update payroll_runs
  set status = 'draft',
      approved_at = null,
      approved_by = null,
      locked_at = null,
      locked_by = null
  where id = rec.id;
  perform set_config('app.payroll_reopen', '0', true);
end;
$$;

create or replace function public.count_leave_days(
  p_org uuid,
  p_start date,
  p_end date,
  p_branch uuid default null,
  p_count_holidays boolean default false
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d date;
  working boolean;
  holiday boolean;
  days numeric := 0;
begin
  if auth.uid() is null or not private.is_org_member(p_org) then
    raise exception 'Not allowed to calculate leave days';
  end if;

  if p_end < p_start then
    raise exception 'The end date is before the start date';
  end if;

  d := p_start;
  while d <= p_end loop
    select is_working into working
    from working_days
    where organization_id = p_org
      and weekday = extract(dow from d)::integer;

    if coalesce(working, false) then
      select exists (
        select 1 from public_holidays h
        where h.organization_id = p_org
          and h.holiday_date = d
          and h.deleted_at is null
          and h.status = 'active'
          and (h.branch_id is null or h.branch_id = p_branch)
          and (h.location_id is null)
      ) into holiday;

      if p_count_holidays or not holiday then
        days := days + 1;
      end if;
    end if;
    d := d + 1;
  end loop;

  return days;
end;
$$;

create or replace function public.leave_request_conflicts(
  p_employee uuid,
  p_start date,
  p_end date,
  p_exclude uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from leave_requests lr
    join employees e on e.id = lr.employee_id
    where lr.employee_id = p_employee
      and lr.deleted_at is null
      and lr.status in ('pending', 'approved')
      and (p_exclude is null or lr.id <> p_exclude)
      and daterange(lr.start_date, lr.end_date, '[]') && daterange(p_start, p_end, '[]')
      and (
        e.profile_id = auth.uid()
        or private.can_access_employee_row(p_employee, 'leave.view', true)
      )
  );
$$;

create or replace function private.user_matches_step(
  p_org uuid,
  p_step approval_steps,
  p_employee uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if private.is_super_admin(p_org) then
    return true;
  end if;

  if p_step.approver_kind = 'direct_manager' then
    return exists (
      select 1
      from employees report
      join employees manager on manager.id = report.supervisor_id
      where report.id = p_employee
        and manager.profile_id = auth.uid()
        and manager.deleted_at is null
    );
  end if;

  if p_step.approver_kind = 'org_permission' then
    return private.has_org_wide(p_org, p_step.permission_code);
  end if;

  return exists (
    select 1
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.organization_id = p_org
      and ur.status = 'active'
      and ur.scope_type = 'organization'
      and r.code = p_step.role_code
      and (ur.expires_at is null or ur.expires_at > now())
  );
end;
$$;

create or replace function public.submit_approval(
  p_org uuid,
  p_workflow_code text,
  p_entity_type text,
  p_entity_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workflow uuid;
  v_request uuid;
begin
  if auth.uid() is null or not private.is_org_member(p_org) then
    raise exception 'Not allowed to submit this request';
  end if;

  select id into v_workflow
  from approval_workflows
  where organization_id = p_org
    and code = p_workflow_code
    and is_active
    and deleted_at is null;

  if v_workflow is null then
    raise exception 'Approval workflow % is not active', p_workflow_code;
  end if;

  if not exists (select 1 from approval_steps where workflow_id = v_workflow) then
    raise exception 'Approval workflow % has no steps', p_workflow_code;
  end if;

  insert into approval_requests (
    organization_id, workflow_id, entity_type, entity_id, requester_id, current_step, status
  ) values (
    p_org, v_workflow, p_entity_type, p_entity_id, auth.uid(), 1, 'pending'
  )
  returning id into v_request;

  return v_request;
end;
$$;

create or replace function public.act_on_approval(
  p_request uuid,
  p_decision text,
  p_comment text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  req approval_requests%rowtype;
  step approval_steps%rowtype;
  next_step integer;
  v_employee uuid;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select * into req from approval_requests where id = p_request for update;
  if not found then
    raise exception 'Approval request was not found';
  end if;

  if req.status <> 'pending' then
    raise exception 'This request is already %', req.status;
  end if;

  if req.requester_id = auth.uid() and not private.is_super_admin(req.organization_id) then
    raise exception 'You cannot approve your own request';
  end if;

  select * into step
  from approval_steps
  where workflow_id = req.workflow_id
    and step_order = req.current_step;

  if not found then
    raise exception 'The current approval step is missing';
  end if;

  select id into v_employee from employees
  where profile_id = req.requester_id
    and organization_id = req.organization_id
    and deleted_at is null
  limit 1;

  if not private.user_matches_step(req.organization_id, step, v_employee) then
    raise exception 'You are not the current approver';
  end if;

  insert into approval_actions (request_id, step_order, actor_id, decision, comment)
  values (req.id, req.current_step, auth.uid(), p_decision, nullif(trim(coalesce(p_comment, '')), ''));

  if p_decision = 'rejected' then
    update approval_requests
    set status = 'rejected', resolved_at = now()
    where id = req.id;
    return 'rejected';
  end if;

  select min(step_order) into next_step
  from approval_steps
  where workflow_id = req.workflow_id
    and step_order > req.current_step;

  if next_step is null then
    update approval_requests
    set status = 'approved', resolved_at = now()
    where id = req.id;
    return 'approved';
  end if;

  update approval_requests set current_step = next_step where id = req.id;
  return 'pending';
end;
$$;

create or replace function public.assign_user_role(
  p_org uuid,
  p_user uuid,
  p_role_id uuid,
  p_scope_type text,
  p_scope_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role roles%rowtype;
  v_id uuid;
  privileged text[] := array[
    'super_admin', 'hr_admin', 'payroll_admin', 'finance_officer', 'auditor', 'executive'
  ];
begin
  if auth.uid() is null or not private.has_permission(p_org, 'users.manage') then
    raise exception 'You are not allowed to assign roles';
  end if;

  select * into v_role from roles where id = p_role_id and organization_id = p_org and deleted_at is null;
  if not found then
    raise exception 'Role was not found in this organization';
  end if;

  if not exists (
    select 1 from organization_members
    where organization_id = p_org and user_id = p_user and status = 'active'
  ) then
    raise exception 'That person is not an active member of this organization';
  end if;

  if v_role.code = any (privileged) and not private.is_super_admin(p_org) then
    raise exception 'Only a super administrator can assign the % role', v_role.name;
  end if;

  if v_role.code = 'department_head' and (p_scope_type <> 'department' or p_scope_id is null) then
    raise exception 'A department head must be scoped to one department';
  end if;

  if v_role.code in ('line_manager', 'supervisor') and p_scope_type <> 'direct_reports' then
    raise exception 'This role is scoped to direct reports';
  end if;

  if v_role.code = 'employee' then
    p_scope_type := 'self';
    p_scope_id := null;
  elsif v_role.code not in ('department_head', 'line_manager', 'supervisor') then
    p_scope_type := 'organization';
    p_scope_id := null;
  end if;

  update user_roles
  set status = 'active', granted_by = auth.uid()
  where organization_id = p_org
    and user_id = p_user
    and role_id = p_role_id
    and scope_type = p_scope_type
    and scope_id is not distinct from p_scope_id
  returning id into v_id;

  if v_id is null then
    insert into user_roles (
      organization_id, user_id, role_id, scope_type, scope_id, status, granted_by
    ) values (
      p_org, p_user, p_role_id, p_scope_type, p_scope_id, 'active', auth.uid()
    )
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.revoke_user_role(p_assignment uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec user_roles%rowtype;
  v_code text;
begin
  select * into rec from user_roles where id = p_assignment;
  if not found then
    raise exception 'Role assignment was not found';
  end if;

  if not private.has_permission(rec.organization_id, 'users.manage') then
    raise exception 'You are not allowed to change roles';
  end if;

  select code into v_code from roles where id = rec.role_id;

  if v_code = any (array['super_admin', 'hr_admin', 'payroll_admin', 'finance_officer', 'auditor', 'executive'])
    and not private.is_super_admin(rec.organization_id) then
    raise exception 'Only a super administrator can remove that role';
  end if;

  if v_code = 'super_admin' then
    if (
      select count(*) from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.organization_id = rec.organization_id
        and ur.status = 'active'
        and r.code = 'super_admin'
    ) <= 1 then
      raise exception 'The organization needs at least one super administrator';
    end if;
  end if;

  update user_roles set status = 'inactive' where id = rec.id;
end;
$$;

create or replace function public.set_member_status(p_org uuid, p_user uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('active', 'inactive', 'suspended') then
    raise exception 'Unknown member status';
  end if;

  if not private.has_permission(p_org, 'users.manage') then
    raise exception 'You are not allowed to change member access';
  end if;

  if p_user = auth.uid() and p_status <> 'active' then
    raise exception 'You cannot suspend your own access';
  end if;

  update organization_members
  set status = p_status
  where organization_id = p_org and user_id = p_user;

  if not found then
    raise exception 'Membership was not found';
  end if;
end;
$$;

create or replace function public.set_role_permissions(p_role uuid, p_codes text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role roles%rowtype;
begin
  select * into v_role from roles where id = p_role and deleted_at is null;
  if not found then
    raise exception 'Role was not found';
  end if;

  if not private.has_permission(v_role.organization_id, 'roles.manage') then
    raise exception 'You are not allowed to edit permissions';
  end if;

  if v_role.code = 'super_admin' then
    raise exception 'The super administrator role always has every permission';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_codes, '{}'::text[])) as code
    where not exists (select 1 from permissions p where p.code = code)
  ) then
    raise exception 'One of the permissions is not in the catalogue';
  end if;

  delete from role_permissions where role_id = p_role;

  insert into role_permissions (role_id, permission_id)
  select p_role, p.id
  from permissions p
  where p.code = any (coalesce(p_codes, '{}'::text[]));
end;
$$;

create or replace function public.mark_notification_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update notifications
  set status = 'read', read_at = now()
  where id = p_id
    and recipient_id = auth.uid()
    and channel = 'in_app';
end;
$$;

create or replace function public.verify_id_card(p_token uuid)
returns table (
  valid boolean,
  employee_name text,
  employee_number text,
  job_title text,
  department text,
  card_status text,
  expires_on date,
  organization_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rec record;
begin
  select
    c.status,
    c.expires_at,
    e.first_name,
    e.last_name,
    e.employee_number,
    e.employment_status,
    t.name as title_name,
    d.name as department_name,
    o.trading_name,
    o.legal_name
  into rec
  from id_cards c
  join employees e on e.id = c.employee_id
  join organizations o on o.id = c.organization_id
  left join job_titles t on t.id = e.job_title_id
  left join departments d on d.id = e.department_id
  where c.qr_token = p_token
    and e.deleted_at is null;

  if not found then
    valid := false;
    employee_name := null;
    employee_number := null;
    job_title := null;
    department := null;
    card_status := null;
    expires_on := null;
    organization_name := null;
    return next;
    return;
  end if;

  card_status := rec.status;
  expires_on := rec.expires_at;
  employee_name := trim(rec.first_name || ' ' || rec.last_name);
  employee_number := rec.employee_number;
  job_title := rec.title_name;
  department := rec.department_name;
  organization_name := coalesce(rec.trading_name, rec.legal_name);
  valid := rec.status = 'active'
    and rec.employment_status not in ('exited', 'archived')
    and (rec.expires_at is null or rec.expires_at >= current_date);
  return next;
end;
$$;
