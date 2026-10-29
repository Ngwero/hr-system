-- Row Level Security. Frontend hiding is not access control.

create or replace function private.apply_member_read(p_table text, p_write_permission text, p_has_deleted boolean)
returns void
language plpgsql
as $$
declare
  read_expr text;
  write_expr text;
begin
  write_expr := format('private.has_permission(organization_id, %L)', p_write_permission);
  if p_has_deleted then
    read_expr := format(
      'private.is_org_member(organization_id) and (deleted_at is null or private.has_permission(organization_id, %L))',
      'audit.view'
    );
  else
    read_expr := 'private.is_org_member(organization_id)';
  end if;

  execute format('drop policy if exists %I on public.%I', p_table || '_select', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_insert', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_update', p_table);
  execute format('create policy %I on public.%I for select to authenticated using (%s)', p_table || '_select', p_table, read_expr);
  execute format('create policy %I on public.%I for insert to authenticated with check (%s)', p_table || '_insert', p_table, write_expr);
  execute format(
    'create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
    p_table || '_update', p_table, write_expr, write_expr
  );
end;
$$;

create or replace function private.apply_permission_access(p_table text, p_read text, p_write text, p_has_deleted boolean)
returns void
language plpgsql
as $$
declare
  read_expr text;
  write_expr text;
begin
  write_expr := format('private.has_permission(organization_id, %L)', p_write);
  if p_has_deleted then
    read_expr := format(
      'private.has_permission(organization_id, %L) and (deleted_at is null or private.has_permission(organization_id, %L))',
      p_read, 'audit.view'
    );
  else
    read_expr := format('private.has_permission(organization_id, %L)', p_read);
  end if;

  execute format('drop policy if exists %I on public.%I', p_table || '_select', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_insert', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_update', p_table);
  execute format('create policy %I on public.%I for select to authenticated using (%s)', p_table || '_select', p_table, read_expr);
  execute format('create policy %I on public.%I for insert to authenticated with check (%s)', p_table || '_insert', p_table, write_expr);
  execute format(
    'create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
    p_table || '_update', p_table, write_expr, write_expr
  );
end;
$$;

do $$
declare
  rec record;
begin
  for rec in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', rec.tablename);
    execute format('alter table public.%I force row level security', rec.tablename);
  end loop;
end;
$$;

-- Organisation reference data is visible to members. Changes require a permission.
select private.apply_member_read('branches', 'organization.manage', true);
select private.apply_member_read('locations', 'organization.manage', true);
select private.apply_member_read('divisions', 'organization.manage', true);
select private.apply_member_read('business_units', 'organization.manage', true);
select private.apply_member_read('departments', 'organization.manage', true);
select private.apply_member_read('teams', 'organization.manage', true);
select private.apply_member_read('cost_centres', 'organization.manage', true);
select private.apply_member_read('job_grades', 'organization.manage', true);
select private.apply_member_read('job_titles', 'organization.manage', true);
select private.apply_member_read('public_holidays', 'organization.manage', true);
select private.apply_member_read('working_days', 'organization.manage', false);
select private.apply_member_read('shifts', 'attendance.manage', true);
select private.apply_member_read('leave_types', 'leave.manage', true);
select private.apply_member_read('skills', 'training.manage', true);
select private.apply_member_read('competencies', 'performance.manage', true);
select private.apply_member_read('approval_workflows', 'organization.manage', true);

-- The organisations select policy from apply_member_read requires membership.
-- Replace it so a platform administrator can see companies they belong to,
-- and a member can see their own company. Creation stays in security-definer functions.
create policy organizations_select on public.organizations
  for select to authenticated
  using (
    deleted_at is null
    and private.is_org_member(id)
  );

create policy organizations_update on public.organizations
  for update to authenticated
  using (private.has_permission(id, 'organization.manage'))
  with check (private.has_permission(id, 'organization.manage'));

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from organization_members mine
      join organization_members theirs
        on theirs.organization_id = mine.organization_id
       and theirs.user_id = profiles.id
      where mine.user_id = auth.uid()
        and mine.status = 'active'
        and (
          private.has_permission(mine.organization_id, 'users.view')
          or private.has_permission(mine.organization_id, 'directory.view')
        )
    )
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy members_select on public.organization_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or private.has_permission(organization_id, 'users.view')
  );

create policy permissions_select on public.permissions
  for select to authenticated
  using (true);

create policy roles_select on public.roles
  for select to authenticated
  using (private.is_org_member(organization_id) and (deleted_at is null or private.has_permission(organization_id, 'audit.view')));

create policy roles_insert on public.roles
  for insert to authenticated
  with check (
    private.has_permission(organization_id, 'roles.manage')
    and is_system = false
  );

create policy roles_update on public.roles
  for update to authenticated
  using (private.has_permission(organization_id, 'roles.manage'))
  with check (private.has_permission(organization_id, 'roles.manage'));

create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (
    exists (
      select 1 from roles r
      where r.id = role_permissions.role_id
        and private.is_org_member(r.organization_id)
    )
  );

create policy user_roles_select on public.user_roles
  for select to authenticated
  using (
    user_id = auth.uid()
    or private.has_permission(organization_id, 'users.view')
  );

create policy audit_select on public.audit_logs
  for select to authenticated
  using (organization_id is not null and private.has_permission(organization_id, 'audit.view'));

create policy number_sequences_select on public.number_sequences
  for select to authenticated
  using (private.has_permission(organization_id, 'organization.manage'));

create policy number_sequences_update on public.number_sequences
  for update to authenticated
  using (private.has_permission(organization_id, 'organization.manage'))
  with check (private.has_permission(organization_id, 'organization.manage'));

-- Employees. Work profile vs private profile vs pay are different policies.
-- Use the current row. A helper that re-reads employees is false during INSERT ... RETURNING
-- because that lookup cannot see the row being checked.
create policy employees_select on public.employees
  for select to authenticated
  using (
    (
      deleted_at is null
      and (
        profile_id = auth.uid()
        or private.has_permission(organization_id, 'directory.view')
        or private.has_org_wide(organization_id, 'employee.view')
        or (
          private.has_permission(organization_id, 'employee.view')
          and private.employee_in_scope(id)
        )
      )
    )
    or (
      deleted_at is not null
      and private.has_org_wide(organization_id, 'employee.view')
      and private.has_permission(organization_id, 'audit.view')
    )
  );

create policy employees_insert on public.employees
  for insert to authenticated
  with check (private.has_org_wide(organization_id, 'employee.create'));

create policy employees_update on public.employees
  for update to authenticated
  using (
    private.has_org_wide(organization_id, 'employee.edit')
    or (private.has_permission(organization_id, 'employee.edit') and private.employee_in_scope(id))
  )
  with check (
    private.has_org_wide(organization_id, 'employee.edit')
    or (private.has_permission(organization_id, 'employee.edit') and private.employee_in_scope(id))
  );

create policy employee_personal_all on public.employee_personal
  for all to authenticated
  using (private.can_access_employee_row(employee_id, 'employee.view_sensitive', true)
      or private.can_access_employee_row(employee_id, 'employee.view', true))
  with check (private.has_org_wide(organization_id, 'employee.edit')
      or exists (select 1 from employees e where e.id = employee_id and e.profile_id = auth.uid()));

create policy employee_ids_all on public.employee_identifications
  for all to authenticated
  using (private.can_access_employee_row(employee_id, 'employee.view_sensitive', true))
  with check (
    private.has_org_wide(organization_id, 'employee.view_sensitive')
    or exists (select 1 from employees e where e.id = employee_id and e.profile_id = auth.uid())
  );

create policy employee_emergency_all on public.employee_emergency_contacts
  for all to authenticated
  using (private.can_access_employee_row(employee_id, 'employee.view', true))
  with check (private.can_access_employee_row(employee_id, 'employee.edit', true));

create policy employee_dependants_all on public.employee_dependants
  for all to authenticated
  using (private.can_access_employee_row(employee_id, 'employee.view_sensitive', true))
  with check (private.can_access_employee_row(employee_id, 'employee.view_sensitive', true));

create policy employee_bank_all on public.employee_bank_accounts
  for all to authenticated
  using (private.can_access_employee_row(employee_id, 'bank.view', true))
  with check (
    private.has_org_wide(organization_id, 'bank.view')
    or exists (select 1 from employees e where e.id = employee_id and e.profile_id = auth.uid())
  );

create policy employee_documents_select on public.employee_documents
  for select to authenticated
  using (
    (
      confidentiality = 'restricted'
      and private.has_org_wide(organization_id, 'documents.manage')
    )
    or (
      confidentiality <> 'restricted'
      and (
        private.has_org_wide(organization_id, 'documents.view')
        or private.has_org_wide(organization_id, 'documents.manage')
        or exists (select 1 from employees e where e.id = employee_id and e.profile_id = auth.uid())
      )
    )
  );

create policy employee_documents_write on public.employee_documents
  for insert to authenticated
  with check (private.has_org_wide(organization_id, 'documents.manage'));

create policy employee_documents_update on public.employee_documents
  for update to authenticated
  using (private.has_org_wide(organization_id, 'documents.manage'))
  with check (private.has_org_wide(organization_id, 'documents.manage'));

create policy employment_history_select on public.employment_history
  for select to authenticated
  using (private.can_access_employee_row(employee_id, 'employee.view', false));

create policy employment_history_insert on public.employment_history
  for insert to authenticated
  with check (private.has_org_wide(organization_id, 'employee.edit'));

create policy id_templates_select on public.id_card_templates
  for select to authenticated
  using (private.is_org_member(organization_id) and deleted_at is null);

create policy id_templates_write on public.id_card_templates
  for all to authenticated
  using (private.has_permission(organization_id, 'id_cards.manage'))
  with check (private.has_permission(organization_id, 'id_cards.manage'));

create policy id_cards_select on public.id_cards
  for select to authenticated
  using (
    private.has_permission(organization_id, 'id_cards.manage')
    or exists (select 1 from employees e where e.id = employee_id and e.profile_id = auth.uid())
  );

create policy id_cards_write on public.id_cards
  for all to authenticated
  using (private.has_permission(organization_id, 'id_cards.manage'))
  with check (private.has_permission(organization_id, 'id_cards.manage'));

-- Pay. Employees can read their own published result. They cannot read the company run.
create policy compensation_all on public.employee_compensation
  for select to authenticated
  using (private.can_access_employee_row(employee_id, 'salary.view', true));

create policy compensation_write on public.employee_compensation
  for insert to authenticated
  with check (private.has_org_wide(organization_id, 'salary.propose'));

create policy compensation_update on public.employee_compensation
  for update to authenticated
  using (private.has_org_wide(organization_id, 'salary.propose'))
  with check (private.has_org_wide(organization_id, 'salary.propose'));

create policy salary_history_select on public.salary_history
  for select to authenticated
  using (private.can_access_employee_row(employee_id, 'salary.view', true));

create policy salary_history_insert on public.salary_history
  for insert to authenticated
  with check (private.has_org_wide(organization_id, 'salary.propose'));

create policy grade_bands_all on public.job_grade_bands
  for select to authenticated
  using (private.has_org_wide(organization_id, 'salary.view'));

create policy grade_bands_write on public.job_grade_bands
  for all to authenticated
  using (private.has_org_wide(organization_id, 'salary.propose'))
  with check (private.has_org_wide(organization_id, 'salary.propose'));

create policy payroll_settings_all on public.employee_payroll_settings
  for all to authenticated
  using (private.can_access_employee_row(employee_id, 'payroll.view', true))
  with check (private.has_org_wide(organization_id, 'payroll.configure') or private.has_org_wide(organization_id, 'payroll.run'));

select private.apply_permission_access('statutory_rule_sets', 'payroll.view', 'payroll.configure', false);
select private.apply_permission_access('earning_types', 'payroll.view', 'payroll.configure', true);
select private.apply_permission_access('deduction_types', 'payroll.view', 'payroll.configure', true);
select private.apply_permission_access('payroll_periods', 'payroll.view', 'payroll.run', true);
select private.apply_permission_access('benefit_plans', 'payroll.view', 'payroll.configure', true);

create policy tax_brackets_select on public.tax_brackets
  for select to authenticated
  using (
    exists (
      select 1 from statutory_rule_sets s
      where s.id = tax_brackets.rule_set_id
        and private.has_permission(s.organization_id, 'payroll.view')
    )
  );

create policy tax_brackets_write on public.tax_brackets
  for all to authenticated
  using (
    exists (
      select 1 from statutory_rule_sets s
      where s.id = tax_brackets.rule_set_id
        and private.has_permission(s.organization_id, 'payroll.configure')
    )
  )
  with check (
    exists (
      select 1 from statutory_rule_sets s
      where s.id = tax_brackets.rule_set_id
        and private.has_permission(s.organization_id, 'payroll.configure')
    )
  );

create policy payroll_runs_select on public.payroll_runs
  for select to authenticated
  using (private.has_org_wide(organization_id, 'payroll.view'));

create policy payroll_runs_write on public.payroll_runs
  for all to authenticated
  using (private.has_org_wide(organization_id, 'payroll.run'))
  with check (private.has_org_wide(organization_id, 'payroll.run'));

create policy payroll_entries_select on public.payroll_entries
  for select to authenticated
  using (
    private.has_org_wide(organization_id, 'payroll.view')
    or exists (
      select 1
      from employees e
      join payroll_runs r on r.id = payroll_entries.payroll_run_id
      where e.id = payroll_entries.employee_id
        and e.profile_id = auth.uid()
        and r.status in ('locked', 'paid')
    )
  );

create policy payroll_entries_write on public.payroll_entries
  for all to authenticated
  using (private.has_org_wide(organization_id, 'payroll.run'))
  with check (private.has_org_wide(organization_id, 'payroll.run'));

create policy payroll_lines_select on public.payroll_line_items
  for select to authenticated
  using (
    exists (
      select 1 from payroll_entries e
      where e.id = payroll_line_items.payroll_entry_id
        and (
          private.has_org_wide(e.organization_id, 'payroll.view')
          or exists (
            select 1 from employees emp
            join payroll_runs r on r.id = e.payroll_run_id
            where emp.id = e.employee_id
              and emp.profile_id = auth.uid()
              and r.status in ('locked', 'paid')
          )
        )
    )
  );

create policy payslips_select on public.payslips
  for select to authenticated
  using (
    private.has_org_wide(organization_id, 'payroll.view')
    or exists (select 1 from employees e where e.id = employee_id and e.profile_id = auth.uid())
  );

create policy payslips_write on public.payslips
  for insert to authenticated
  with check (private.has_org_wide(organization_id, 'payroll.run'));

create policy reopen_select on public.payroll_reopen_events
  for select to authenticated
  using (private.has_org_wide(organization_id, 'payroll.view') or private.has_permission(organization_id, 'audit.view'));

create policy loans_select on public.employee_loans
  for select to authenticated
  using (private.can_access_employee_row(employee_id, 'loans.view', true));

create policy loans_write on public.employee_loans
  for all to authenticated
  using (private.has_org_wide(organization_id, 'loans.manage') or private.can_access_employee_row(employee_id, 'loans.manage', true))
  with check (private.has_permission(organization_id, 'loans.manage'));

create policy loan_repayments_select on public.loan_repayments
  for select to authenticated
  using (
    exists (
      select 1 from employee_loans l
      where l.id = loan_repayments.loan_id
        and private.can_access_employee_row(l.employee_id, 'loans.view', true)
    )
  );

create policy benefits_select on public.employee_benefits
  for select to authenticated
  using (private.can_access_employee_row(employee_id, 'payroll.view', true));

create policy benefits_write on public.employee_benefits
  for all to authenticated
  using (private.has_org_wide(organization_id, 'payroll.configure'))
  with check (private.has_org_wide(organization_id, 'payroll.configure'));

-- Workforce rows follow the employee they belong to.
create policy attendance_all on public.attendance
  for all to authenticated
  using (private.can_access_employee_row(employee_id, 'attendance.view', true))
  with check (
    private.has_permission(organization_id, 'attendance.manage')
    or private.has_permission(organization_id, 'attendance.clock')
  );

create policy overtime_all on public.overtime_requests
  for all to authenticated
  using (private.can_access_employee_row(employee_id, 'attendance.view', true))
  with check (private.can_access_employee_row(employee_id, 'attendance.view', true));

create policy timesheets_all on public.timesheets
  for all to authenticated
  using (private.can_access_employee_row(employee_id, 'attendance.view', true))
  with check (private.can_access_employee_row(employee_id, 'attendance.view', true));

create policy shift_assignments_all on public.shift_assignments
  for all to authenticated
  using (private.can_access_employee_row(employee_id, 'attendance.view', true))
  with check (private.has_permission(organization_id, 'attendance.manage'));

create policy leave_policies_all on public.leave_policies
  for select to authenticated
  using (private.is_org_member(organization_id) and deleted_at is null);

create policy leave_policies_write on public.leave_policies
  for all to authenticated
  using (private.has_permission(organization_id, 'leave.manage'))
  with check (private.has_permission(organization_id, 'leave.manage'));

create policy leave_balances_select on public.leave_balances
  for select to authenticated
  using (private.can_access_employee_row(employee_id, 'leave.view', true));

create policy leave_balances_write on public.leave_balances
  for all to authenticated
  using (private.has_permission(organization_id, 'leave.manage'))
  with check (private.has_permission(organization_id, 'leave.manage'));

create policy leave_requests_all on public.leave_requests
  for all to authenticated
  using (private.can_access_employee_row(employee_id, 'leave.view', true))
  with check (
    private.has_permission(organization_id, 'leave.manage')
    or private.has_permission(organization_id, 'leave.request')
  );

create policy approval_steps_select on public.approval_steps
  for select to authenticated
  using (
    exists (
      select 1 from approval_workflows w
      where w.id = approval_steps.workflow_id
        and private.is_org_member(w.organization_id)
    )
  );

create policy approval_steps_write on public.approval_steps
  for all to authenticated
  using (
    exists (
      select 1 from approval_workflows w
      where w.id = approval_steps.workflow_id
        and private.has_permission(w.organization_id, 'organization.manage')
    )
  )
  with check (
    exists (
      select 1 from approval_workflows w
      where w.id = approval_steps.workflow_id
        and private.has_permission(w.organization_id, 'organization.manage')
    )
  );

create policy approval_requests_select on public.approval_requests
  for select to authenticated
  using (
    requester_id = auth.uid()
    or private.has_permission(organization_id, 'approvals.view')
  );

create policy approval_actions_select on public.approval_actions
  for select to authenticated
  using (
    exists (
      select 1 from approval_requests r
      where r.id = approval_actions.request_id
        and (
          r.requester_id = auth.uid()
          or actor_id = auth.uid()
          or private.has_permission(r.organization_id, 'approvals.view')
        )
    )
  );

-- Talent
select private.apply_permission_access('job_requisitions', 'recruitment.view', 'recruitment.manage', true);
select private.apply_permission_access('vacancies', 'recruitment.view', 'recruitment.manage', true);
select private.apply_permission_access('candidates', 'recruitment.view', 'recruitment.manage', true);
select private.apply_permission_access('candidate_applications', 'recruitment.view', 'recruitment.manage', false);
select private.apply_permission_access('interviews', 'recruitment.view', 'recruitment.manage', false);
select private.apply_permission_access('job_offers', 'recruitment.view', 'recruitment.manage', false);
select private.apply_permission_access('onboarding_templates', 'onboarding.manage', 'onboarding.manage', true);
select private.apply_permission_access('employee_onboarding', 'onboarding.manage', 'onboarding.manage', false);
select private.apply_permission_access('performance_cycles', 'performance.view', 'performance.manage', true);
select private.apply_permission_access('performance_goals', 'performance.view', 'performance.manage', false);
select private.apply_permission_access('performance_reviews', 'performance.view', 'performance.review', false);
select private.apply_permission_access('probation_reviews', 'performance.view', 'performance.review', false);
select private.apply_permission_access('training_courses', 'training.manage', 'training.manage', true);
select private.apply_permission_access('training_sessions', 'training.manage', 'training.manage', false);
select private.apply_permission_access('certifications', 'training.manage', 'training.manage', false);

create policy interview_scores_all on public.interview_scores
  for all to authenticated
  using (
    exists (
      select 1
      from interviews i
      join candidate_applications a on a.id = i.application_id
      where i.id = interview_scores.interview_id
        and private.has_permission(a.organization_id, 'recruitment.view')
    )
  )
  with check (
    exists (
      select 1
      from interviews i
      join candidate_applications a on a.id = i.application_id
      where i.id = interview_scores.interview_id
        and private.has_permission(a.organization_id, 'recruitment.manage')
    )
  );

create policy onboarding_template_tasks_all on public.onboarding_template_tasks
  for all to authenticated
  using (
    exists (
      select 1 from onboarding_templates t
      where t.id = onboarding_template_tasks.template_id
        and private.has_permission(t.organization_id, 'onboarding.manage')
    )
  )
  with check (
    exists (
      select 1 from onboarding_templates t
      where t.id = onboarding_template_tasks.template_id
        and private.has_permission(t.organization_id, 'onboarding.manage')
    )
  );

create policy onboarding_tasks_all on public.employee_onboarding_tasks
  for all to authenticated
  using (
    exists (
      select 1 from employee_onboarding o
      where o.id = employee_onboarding_tasks.onboarding_id
        and (
          private.has_permission(o.organization_id, 'onboarding.manage')
          or assigned_to = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1 from employee_onboarding o
      where o.id = employee_onboarding_tasks.onboarding_id
        and private.has_permission(o.organization_id, 'onboarding.manage')
    )
  );

create policy review_ratings_all on public.review_competency_ratings
  for all to authenticated
  using (
    exists (
      select 1 from performance_reviews r
      where r.id = review_competency_ratings.review_id
        and private.can_access_employee_row(r.employee_id, 'performance.view', true)
    )
  )
  with check (
    exists (
      select 1 from performance_reviews r
      where r.id = review_competency_ratings.review_id
        and private.has_permission(r.organization_id, 'performance.review')
    )
  );

create policy employee_skills_all on public.employee_skills
  for all to authenticated
  using (private.can_access_employee_row(employee_id, 'training.manage', true) or private.can_access_employee_row(employee_id, 'employee.view', true))
  with check (private.has_permission(organization_id, 'training.manage'));

create policy training_attendance_all on public.training_attendance
  for all to authenticated
  using (
    exists (
      select 1 from training_sessions s
      where s.id = training_attendance.session_id
        and (
          private.has_permission(s.organization_id, 'training.manage')
          or exists (select 1 from employees e where e.id = training_attendance.employee_id and e.profile_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from training_sessions s
      where s.id = training_attendance.session_id
        and private.has_permission(s.organization_id, 'training.manage')
    )
  );

-- Relations, assets, money claims, communications.
create policy disciplinary_select on public.disciplinary_cases
  for select to authenticated
  using (private.can_access_employee_row(employee_id, 'disciplinary.view', true));

create policy disciplinary_write on public.disciplinary_cases
  for all to authenticated
  using (private.has_permission(organization_id, 'disciplinary.manage') or private.has_permission(organization_id, 'disciplinary.initiate'))
  with check (private.has_permission(organization_id, 'disciplinary.manage') or private.has_permission(organization_id, 'disciplinary.initiate'));

create policy grievances_select on public.grievances
  for select to authenticated
  using (
    exists (select 1 from employees e where e.id = employee_id and e.profile_id = auth.uid())
    or assigned_to = auth.uid()
    or (
      private.has_org_wide(organization_id, 'grievance.manage')
    )
  );

create policy grievances_insert on public.grievances
  for insert to authenticated
  with check (
    private.has_permission(organization_id, 'grievance.submit')
    and exists (select 1 from employees e where e.id = employee_id and e.profile_id = auth.uid())
  );

create policy grievances_update on public.grievances
  for update to authenticated
  using (private.has_org_wide(organization_id, 'grievance.manage') or assigned_to = auth.uid())
  with check (private.has_org_wide(organization_id, 'grievance.manage') or assigned_to = auth.uid());

select private.apply_permission_access('assets', 'assets.view', 'assets.manage', true);

create policy asset_assignments_select on public.asset_assignments
  for select to authenticated
  using (
    private.has_permission(organization_id, 'assets.view')
    or exists (select 1 from employees e where e.id = employee_id and e.profile_id = auth.uid())
  );

create policy asset_assignments_write on public.asset_assignments
  for all to authenticated
  using (private.has_permission(organization_id, 'assets.manage'))
  with check (private.has_permission(organization_id, 'assets.manage'));

create policy expenses_select on public.expense_claims
  for select to authenticated
  using (private.can_access_employee_row(employee_id, 'expenses.approve', true) or private.has_org_wide(organization_id, 'expenses.pay'));

create policy expenses_insert on public.expense_claims
  for insert to authenticated
  with check (
    private.has_permission(organization_id, 'expenses.submit')
    and exists (select 1 from employees e where e.id = employee_id and (e.profile_id = auth.uid() or private.has_org_wide(organization_id, 'expenses.pay')))
  );

create policy expenses_update on public.expense_claims
  for update to authenticated
  using (
    private.can_access_employee_row(employee_id, 'expenses.approve', true)
    or private.has_org_wide(organization_id, 'expenses.pay')
  )
  with check (
    private.has_permission(organization_id, 'expenses.approve')
    or private.has_permission(organization_id, 'expenses.pay')
    or private.has_permission(organization_id, 'expenses.submit')
  );

create policy expense_items_all on public.expense_items
  for all to authenticated
  using (
    exists (
      select 1 from expense_claims c
      where c.id = expense_items.claim_id
        and (
          private.can_access_employee_row(c.employee_id, 'expenses.approve', true)
          or private.has_org_wide(c.organization_id, 'expenses.pay')
        )
    )
  )
  with check (
    exists (
      select 1 from expense_claims c
      where c.id = expense_items.claim_id
        and (
          private.can_access_employee_row(c.employee_id, 'expenses.submit', true)
          or private.has_permission(c.organization_id, 'expenses.approve')
        )
    )
  );

create policy travel_all on public.travel_requests
  for all to authenticated
  using (private.can_access_employee_row(employee_id, 'expenses.approve', true))
  with check (private.can_access_employee_row(employee_id, 'expenses.submit', true) or private.has_permission(organization_id, 'expenses.approve'));

select private.apply_permission_access('letter_templates', 'letters.generate', 'letters.generate', true);
select private.apply_permission_access('hr_letters', 'letters.generate', 'letters.generate', false);
select private.apply_permission_access('offboarding_cases', 'offboarding.manage', 'offboarding.manage', true);
select private.apply_permission_access('exit_interviews', 'offboarding.manage', 'offboarding.manage', false);

create policy offboarding_tasks_all on public.offboarding_tasks
  for all to authenticated
  using (
    exists (
      select 1 from offboarding_cases c
      where c.id = offboarding_tasks.case_id
        and private.has_permission(c.organization_id, 'offboarding.manage')
    )
  )
  with check (
    exists (
      select 1 from offboarding_cases c
      where c.id = offboarding_tasks.case_id
        and private.has_permission(c.organization_id, 'offboarding.manage')
    )
  );

create policy announcements_select on public.announcements
  for select to authenticated
  using (
    private.is_org_member(organization_id)
    and deleted_at is null
    and (
      private.has_permission(organization_id, 'announcements.manage')
      or (
        status = 'published'
        and (publish_at is null or publish_at <= now())
        and (expires_at is null or expires_at > now())
        and private.has_permission(organization_id, 'announcements.view')
        and (
          not exists (select 1 from announcement_targets t where t.announcement_id = announcements.id)
          or exists (
            select 1 from announcement_targets t
            where t.announcement_id = announcements.id
              and (
                t.target_type = 'company'
                or (
                  t.target_type = 'department'
                  and t.target_id in (
                    select e.department_id from employees e
                    where e.profile_id = auth.uid() and e.organization_id = announcements.organization_id
                  )
                )
                or (
                  t.target_type = 'branch'
                  and t.target_id in (
                    select e.branch_id from employees e
                    where e.profile_id = auth.uid() and e.organization_id = announcements.organization_id
                  )
                )
                or (
                  t.target_type = 'role'
                  and t.target_id in (
                    select ur.role_id from user_roles ur
                    where ur.user_id = auth.uid()
                      and ur.organization_id = announcements.organization_id
                      and ur.status = 'active'
                  )
                )
              )
          )
        )
      )
    )
  );

create policy announcements_write on public.announcements
  for all to authenticated
  using (private.has_permission(organization_id, 'announcements.manage'))
  with check (private.has_permission(organization_id, 'announcements.manage'));

create policy announcement_targets_all on public.announcement_targets
  for all to authenticated
  using (
    exists (
      select 1 from announcements a
      where a.id = announcement_targets.announcement_id
        and private.has_permission(a.organization_id, 'announcements.manage')
    )
  )
  with check (
    exists (
      select 1 from announcements a
      where a.id = announcement_targets.announcement_id
        and private.has_permission(a.organization_id, 'announcements.manage')
    )
  );

create policy notifications_select on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid());

create policy notifications_update on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid() and channel = 'in_app')
  with check (recipient_id = auth.uid());

create policy notification_prefs_all on public.notification_preferences
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy tickets_select on public.hr_tickets
  for select to authenticated
  using (
    requester_id = auth.uid()
    or assigned_to = auth.uid()
    or private.has_permission(organization_id, 'helpdesk.manage')
  );

create policy tickets_insert on public.hr_tickets
  for insert to authenticated
  with check (
    requester_id = auth.uid()
    and private.has_permission(organization_id, 'helpdesk.submit')
  );

create policy tickets_update on public.hr_tickets
  for update to authenticated
  using (
    private.has_permission(organization_id, 'helpdesk.manage')
    or requester_id = auth.uid()
  )
  with check (
    private.has_permission(organization_id, 'helpdesk.manage')
    or requester_id = auth.uid()
  );

create policy ticket_messages_all on public.hr_ticket_messages
  for all to authenticated
  using (
    exists (
      select 1 from hr_tickets t
      where t.id = hr_ticket_messages.ticket_id
        and (
          t.requester_id = auth.uid()
          or t.assigned_to = auth.uid()
          or private.has_permission(t.organization_id, 'helpdesk.manage')
        )
    )
  )
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from hr_tickets t
      where t.id = hr_ticket_messages.ticket_id
        and (
          t.requester_id = auth.uid()
          or t.assigned_to = auth.uid()
          or private.has_permission(t.organization_id, 'helpdesk.manage')
        )
    )
  );

-- login_attempts, role_permission_templates: RLS on, no policies.
-- Writes to user_roles, organization_members, audit_logs, and reopen events
-- go through security-definer functions.

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

revoke all on public.login_attempts from authenticated;
revoke all on public.role_permission_templates from authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;
revoke insert, update, delete on public.permissions from authenticated;
revoke insert, update, delete on public.user_roles from authenticated;
revoke insert, update, delete on public.organization_members from authenticated;
revoke update, delete on public.salary_history from authenticated;
revoke update, delete on public.employment_history from authenticated;
revoke insert, update, delete on public.payroll_reopen_events from authenticated;
revoke insert, update, delete on public.approval_actions from authenticated;
revoke update, delete on public.loan_repayments from authenticated;
revoke insert on public.notifications from authenticated;

grant execute on function public.setup_available() to anon, authenticated;
grant execute on function public.verify_id_card(uuid) to anon, authenticated;
grant execute on function public.bootstrap_organization(text, text, text, text, text) to authenticated;
grant execute on function public.create_organization(text, text, text, text, uuid) to authenticated;
grant execute on function public.switch_organization(uuid) to authenticated;
grant execute on function public.current_access() to authenticated;
grant execute on function public.set_request_context(text, text) to authenticated;
grant execute on function public.allocate_number(uuid, text) to authenticated;
grant execute on function public.calculate_progressive_tax(uuid, numeric) to authenticated;
grant execute on function public.calculate_statutory_amount(uuid, numeric) to authenticated;
grant execute on function public.statutory_rule_snapshot(uuid) to authenticated;
grant execute on function public.reopen_payroll(uuid, text) to authenticated;
grant execute on function public.count_leave_days(uuid, date, date, uuid, boolean) to authenticated;
grant execute on function public.leave_request_conflicts(uuid, date, date, uuid) to authenticated;
grant execute on function public.submit_approval(uuid, text, text, uuid) to authenticated;
grant execute on function public.act_on_approval(uuid, text, text) to authenticated;
grant execute on function public.assign_user_role(uuid, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.revoke_user_role(uuid) to authenticated;
grant execute on function public.set_member_status(uuid, uuid, text) to authenticated;
grant execute on function public.set_role_permissions(uuid, text[]) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;

revoke execute on function public.bootstrap_organization(text, text, text, text, text) from public, anon;
revoke execute on function public.create_organization(text, text, text, text, uuid) from public, anon;
revoke execute on function public.reopen_payroll(uuid, text) from public, anon;
revoke execute on function public.assign_user_role(uuid, uuid, uuid, text, uuid) from public, anon;
revoke execute on function public.set_role_permissions(uuid, text[]) from public, anon;

revoke delete on all tables in schema public from authenticated;

revoke all on all functions in schema public from public;
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.has_org_wide(uuid, text) to authenticated;
grant execute on function private.can_read_employee(uuid) to authenticated;
grant execute on function private.employee_in_scope(uuid) to authenticated;
grant execute on function private.can_access_employee_row(uuid, text, boolean) to authenticated;

grant execute on function public.setup_available() to anon, authenticated;
grant execute on function public.verify_id_card(uuid) to anon, authenticated;
grant execute on function public.bootstrap_organization(text, text, text, text, text) to authenticated;
grant execute on function public.create_organization(text, text, text, text, uuid) to authenticated;
grant execute on function public.switch_organization(uuid) to authenticated;
grant execute on function public.current_access() to authenticated;
grant execute on function public.set_request_context(text, text) to authenticated;
grant execute on function public.allocate_number(uuid, text) to authenticated;
grant execute on function public.calculate_progressive_tax(uuid, numeric) to authenticated;
grant execute on function public.calculate_statutory_amount(uuid, numeric) to authenticated;
grant execute on function public.statutory_rule_snapshot(uuid) to authenticated;
grant execute on function public.reopen_payroll(uuid, text) to authenticated;
grant execute on function public.count_leave_days(uuid, date, date, uuid, boolean) to authenticated;
grant execute on function public.leave_request_conflicts(uuid, date, date, uuid) to authenticated;
grant execute on function public.submit_approval(uuid, text, text, uuid) to authenticated;
grant execute on function public.act_on_approval(uuid, text, text) to authenticated;
grant execute on function public.assign_user_role(uuid, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.revoke_user_role(uuid) to authenticated;
grant execute on function public.set_member_status(uuid, uuid, text) to authenticated;
grant execute on function public.set_role_permissions(uuid, text[]) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function private.can_access_storage(p_bucket text, p_name text, p_write boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  v_org uuid;
  v_employee uuid;
begin
  if to_regnamespace('storage') is null then
    return false;
  end if;

  parts := storage.foldername(p_name);
  if parts is null or coalesce(array_length(parts, 1), 0) < 1 then
    return false;
  end if;

  begin
    v_org := parts[1]::uuid;
  exception when others then
    return false;
  end;

  if not private.is_org_member(v_org) then
    return false;
  end if;

  if coalesce(array_length(parts, 1), 0) >= 2 then
    begin
      v_employee := parts[2]::uuid;
    exception when others then
      v_employee := null;
    end;
  end if;

  if p_bucket = 'company-branding' then
    return (not p_write) or private.has_permission(v_org, 'organization.manage');
  elsif p_bucket = 'employee-photos' then
    if p_write then
      return private.has_permission(v_org, 'employee.edit') or private.has_permission(v_org, 'employee.create');
    end if;
    return private.has_permission(v_org, 'directory.view');
  elsif p_bucket in ('employee-documents', 'payslips', 'hr-letters') then
    if private.has_org_wide(v_org, 'documents.manage') or private.has_org_wide(v_org, 'payroll.view') or private.has_org_wide(v_org, 'letters.generate') then
      return true;
    end if;
    return not p_write and exists (
      select 1 from employees e
      where e.id = v_employee and e.profile_id = auth.uid() and e.organization_id = v_org
    );
  elsif p_bucket = 'candidate-cvs' then
    return case when p_write
      then private.has_permission(v_org, 'recruitment.manage')
      else private.has_permission(v_org, 'recruitment.view')
    end;
  elsif p_bucket = 'disciplinary-files' then
    return case when p_write
      then private.has_org_wide(v_org, 'disciplinary.manage')
      else private.has_org_wide(v_org, 'disciplinary.view')
    end;
  elsif p_bucket = 'expense-receipts' then
    if private.has_org_wide(v_org, 'expenses.pay') or private.has_org_wide(v_org, 'expenses.approve') then
      return true;
    end if;
    return exists (
      select 1 from employees e
      where e.id = v_employee and e.profile_id = auth.uid() and e.organization_id = v_org
    );
  elsif p_bucket = 'training-certificates' then
    if private.has_org_wide(v_org, 'training.manage') then
      return true;
    end if;
    return not p_write and exists (
      select 1 from employees e
      where e.id = v_employee and e.profile_id = auth.uid() and e.organization_id = v_org
    );
  elsif p_bucket = 'company-assets' then
    return case when p_write
      then private.has_permission(v_org, 'assets.manage')
      else private.has_permission(v_org, 'assets.view') or private.has_permission(v_org, 'assets.manage')
    end;
  end if;

  return false;
end;
$$;

do $$
begin
  if to_regnamespace('storage') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    ('company-branding', 'company-branding', false, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml']),
    ('employee-photos', 'employee-photos', false, 2097152, array['image/png','image/jpeg','image/webp']),
    ('employee-documents', 'employee-documents', false, 20971520, array['application/pdf','image/png','image/jpeg']),
    ('candidate-cvs', 'candidate-cvs', false, 10485760, array['application/pdf']),
    ('hr-letters', 'hr-letters', false, 10485760, array['application/pdf']),
    ('payslips', 'payslips', false, 10485760, array['application/pdf']),
    ('disciplinary-files', 'disciplinary-files', false, 20971520, array['application/pdf','image/png','image/jpeg']),
    ('expense-receipts', 'expense-receipts', false, 10485760, array['application/pdf','image/png','image/jpeg','image/webp']),
    ('training-certificates', 'training-certificates', false, 10485760, array['application/pdf','image/png','image/jpeg']),
    ('company-assets', 'company-assets', false, 20971520, array['application/pdf','image/png','image/jpeg','image/webp'])
  on conflict (id) do nothing;

  execute 'drop policy if exists hrms_storage_select on storage.objects';
  execute 'drop policy if exists hrms_storage_insert on storage.objects';
  execute 'drop policy if exists hrms_storage_update on storage.objects';
  execute $policy$
    create policy hrms_storage_select on storage.objects
    for select to authenticated
    using (private.can_access_storage(bucket_id, name, false))
  $policy$;
  execute $policy$
    create policy hrms_storage_insert on storage.objects
    for insert to authenticated
    with check (private.can_access_storage(bucket_id, name, true))
  $policy$;
  execute $policy$
    create policy hrms_storage_update on storage.objects
    for update to authenticated
    using (private.can_access_storage(bucket_id, name, true))
    with check (private.can_access_storage(bucket_id, name, true))
  $policy$;
end;
$$;

revoke all on function private.can_access_storage(text, text, boolean) from public;
grant execute on function private.can_access_storage(text, text, boolean) to authenticated;
