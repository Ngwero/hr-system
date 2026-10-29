-- Proves the security and payroll rules against a real Postgres database.

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'founder@example.com',
    '{"full_name":"Founder Admin"}'::jsonb
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'employee@example.com',
    '{"full_name":"Employee User"}'::jsonb
  );

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

select public.bootstrap_organization(
  'Acme Holdings',
  'UG',
  'UGX',
  'Africa/Kampala',
  'Founder Admin'
);

insert into organization_members (organization_id, user_id, status)
select active_organization_id, '22222222-2222-2222-2222-222222222222', 'active'
from profiles
where id = '11111111-1111-1111-1111-111111111111';

set role authenticated;

do $$
declare
  access jsonb;
  org_id uuid;
  employee_id uuid;
  rule_id uuid;
  period_id uuid;
  run_id uuid;
  role_id uuid;
  employee_number text;
  tax numeric;
  days numeric;
begin
  access := public.current_access();
  if access->>'full_name' <> 'Founder Admin' then
    raise exception 'Bootstrap did not name the founder';
  end if;
  if jsonb_array_length(access->'permissions') < 40 then
    raise exception 'Super administrator did not receive the permission catalogue';
  end if;
  if (access->>'is_platform_admin')::boolean is not true then
    raise exception 'Founder should be the platform administrator';
  end if;

  org_id := (access->>'active_organization_id')::uuid;

  insert into branches (organization_id, code, name, city, is_head_office)
  values (org_id, 'HQ', 'Head office', 'Kampala', true);

  employee_number := public.allocate_number(org_id, 'employee');
  if employee_number <> 'EMP-00001' then
    raise exception 'Expected EMP-00001, got %', employee_number;
  end if;

  insert into employees (
    organization_id, employee_number, first_name, last_name, employment_status
  ) values (
    org_id, employee_number, 'Amina', 'Nakato', 'active'
  ) returning id into employee_id;

  insert into employee_compensation (
    organization_id, employee_id, currency_code, basic_salary, effective_from, is_current
  ) values (
    org_id, employee_id, 'UGX', 500000, current_date, true
  );

  insert into employee_bank_accounts (
    organization_id, employee_id, bank_name, account_name, account_number
  ) values (
    org_id, employee_id, 'Example Bank', 'Amina Nakato', '1234567890'
  );

  insert into statutory_rule_sets (
    organization_id, country_code, name, category, tax_year, effective_from, calculation_method
  ) values (
    org_id, 'UG', 'Test income tax', 'tax', 2026, date '2026-01-01', 'progressive_bracket'
  ) returning id into rule_id;

  insert into tax_brackets (rule_set_id, band_order, from_amount, to_amount, rate)
  values
    (rule_id, 1, 0, 235000, 0),
    (rule_id, 2, 235000, 335000, 0.10),
    (rule_id, 3, 335000, 410000, 0.20),
    (rule_id, 4, 410000, null, 0.30);

  tax := public.calculate_progressive_tax(rule_id, 300000);
  if tax <> 6500 then
    raise exception 'Expected tax 6500 for 300000, got %', tax;
  end if;

  tax := public.calculate_progressive_tax(rule_id, 500000);
  if tax <> 52000 then
    raise exception 'Expected tax 52000 for 500000, got %', tax;
  end if;

  days := public.count_leave_days(org_id, date '2026-10-26', date '2026-11-01', null, false);
  if days <> 5 then
    raise exception 'Expected 5 working days in that week, got %', days;
  end if;

  insert into public_holidays (organization_id, country_code, name, holiday_date)
  values (org_id, 'UG', 'Test holiday', date '2026-10-28');

  days := public.count_leave_days(org_id, date '2026-10-26', date '2026-11-01', null, false);
  if days <> 4 then
    raise exception 'A public holiday should not consume a working day, got %', days;
  end if;

  insert into payroll_periods (
    organization_id, name, frequency, period_start, period_end, status
  ) values (
    org_id, 'October 2026', 'monthly', date '2026-10-01', date '2026-10-31', 'draft'
  ) returning id into period_id;

  insert into payroll_runs (
    organization_id, period_id, run_number, status, currency_code, totals
  ) values (
    org_id, period_id, 1, 'draft', 'UGX', '{"net": 100}'::jsonb
  ) returning id into run_id;

  update payroll_runs set status = 'calculated' where id = run_id;
  update payroll_runs set status = 'reviewed' where id = run_id;
  update payroll_runs set status = 'approved', approved_at = now() where id = run_id;

  begin
    update payroll_runs set totals = '{"net": 1}'::jsonb where id = run_id;
    raise exception 'Approved payroll accepted a figure change';
  exception when others then
    if sqlerrm not like '%frozen%' then
      raise;
    end if;
  end;

  perform public.reopen_payroll(run_id, 'Correction after payroll review');
  if (select status from payroll_runs where id = run_id) <> 'draft' then
    raise exception 'Reopen did not return the run to draft';
  end if;

  update statutory_rule_sets set is_locked = true where id = rule_id;
  begin
    update tax_brackets set rate = 0.5 where rule_set_id = rule_id and band_order = 2;
    raise exception 'Locked tax bracket accepted an edit';
  exception when others then
    if sqlerrm not like '%Brackets%' then
      raise;
    end if;
  end;

  select id into role_id from roles where organization_id = org_id and code = 'employee';
  perform public.assign_user_role(
    org_id,
    '22222222-2222-2222-2222-222222222222',
    role_id,
    'organization',
    null
  );
end $$;

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;

do $$
declare
  branch_count integer;
begin
  select count(*) into branch_count from branches;
  if branch_count <> 1 then
    raise exception 'Employee should see the branch directory, got %', branch_count;
  end if;

  if (select count(*) from employees) <> 1 then
    raise exception 'Directory permission should show the work profile';
  end if;

  if (select count(*) from employee_compensation) <> 0 then
    raise exception 'Employee role can read another person salary';
  end if;

  if (select count(*) from employee_bank_accounts) <> 0 then
    raise exception 'Employee role can read another person bank account';
  end if;

  if (select count(*) from payroll_runs) <> 0 then
    raise exception 'Employee role can read payroll runs';
  end if;

  begin
    insert into branches (organization_id, code, name)
    select id, 'BR2', 'Should fail' from organizations;
    raise exception 'Employee role inserted a branch';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
