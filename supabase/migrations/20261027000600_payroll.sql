-- Payroll configuration and runs.
-- Statutory rates are data. A locked run stores the rules it used.
-- Changing next year's brackets does not rewrite a paid period.

create table public.statutory_rule_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  name text not null,
  category text not null
    check (category in ('tax', 'social_security', 'pension', 'insurance', 'local_service_tax', 'other')),
  tax_year integer not null,
  effective_from date not null,
  effective_to date,
  calculation_method text not null
    check (calculation_method in ('progressive_bracket', 'flat_percent', 'fixed_amount')),
  employee_rate numeric(10, 6),
  employer_rate numeric(10, 6),
  threshold_amount numeric(14, 2),
  ceiling_amount numeric(14, 2),
  fixed_amount numeric(14, 2),
  contribution_base text not null default 'taxable'
    check (contribution_base in ('basic', 'gross', 'taxable')),
  config jsonb not null default '{}'::jsonb,
  is_locked boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.tax_brackets (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.statutory_rule_sets (id) on delete cascade,
  band_order integer not null check (band_order > 0),
  from_amount numeric(14, 2) not null check (from_amount >= 0),
  to_amount numeric(14, 2),
  rate numeric(10, 6) not null check (rate >= 0 and rate <= 1),
  unique (rule_set_id, band_order),
  check (to_amount is null or to_amount > from_amount)
);

create table public.earning_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  code text not null,
  name text not null,
  taxable boolean not null default true,
  is_statutory boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.deduction_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  code text not null,
  name text not null,
  category text not null default 'voluntary'
    check (category in ('statutory', 'voluntary', 'loan', 'absence')),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.employee_compensation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  basic_salary numeric(14, 2) not null check (basic_salary >= 0),
  pay_frequency text not null default 'monthly'
    check (pay_frequency in ('monthly', 'weekly', 'biweekly')),
  effective_from date not null,
  effective_to date,
  is_current boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create unique index employee_compensation_current_idx
  on public.employee_compensation (employee_id)
  where is_current;

create table public.salary_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  previous_basic numeric(14, 2),
  new_basic numeric(14, 2) not null,
  currency_code text not null,
  effective_date date not null,
  change_type text not null
    check (change_type in ('hire', 'promotion', 'adjustment', 'acting', 'demotion')),
  reason text,
  approved_by uuid,
  document_id uuid references public.employee_documents (id),
  created_by uuid,
  created_at timestamptz not null default now()
);

create trigger salary_history_immutable
  before update or delete on public.salary_history
  for each row execute function private.reject_history_mutation();

create trigger salary_history_audit
  after insert on public.salary_history
  for each row execute function private.audit_row('payroll');

create table public.employee_payroll_settings (
  employee_id uuid primary key references public.employees (id) on delete cascade,
  organization_id uuid not null references public.organizations (id),
  tax_identification text,
  social_security_number text,
  pension_number text,
  tax_relief numeric(14, 2) not null default 0,
  resident boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  frequency text not null check (frequency in ('monthly', 'weekly', 'biweekly', 'custom')),
  period_start date not null,
  period_end date not null,
  pay_date date,
  status text not null default 'draft'
    check (status in ('draft', 'calculated', 'reviewed', 'approved', 'locked', 'paid')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  period_id uuid not null references public.payroll_periods (id),
  run_number integer not null check (run_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'calculated', 'reviewed', 'approved', 'locked', 'paid')),
  currency_code text not null,
  rules_snapshot jsonb not null default '{}'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  notes text,
  calculated_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  locked_at timestamptz,
  locked_by uuid,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, run_number)
);

create table public.payroll_reopen_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  payroll_run_id uuid not null references public.payroll_runs (id),
  previous_status text not null,
  reason text not null check (char_length(reason) >= 8),
  reopened_by uuid not null,
  created_at timestamptz not null default now()
);

create trigger payroll_reopen_events_immutable
  before update or delete on public.payroll_reopen_events
  for each row execute function private.reject_history_mutation();

create table public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  payroll_run_id uuid not null references public.payroll_runs (id),
  employee_id uuid not null references public.employees (id),
  employee_number text not null,
  employee_name text not null,
  department_name text,
  job_title text,
  basic_salary numeric(14, 2) not null default 0,
  gross_pay numeric(14, 2) not null default 0,
  taxable_income numeric(14, 2) not null default 0,
  statutory_deductions numeric(14, 2) not null default 0,
  voluntary_deductions numeric(14, 2) not null default 0,
  employer_contributions numeric(14, 2) not null default 0,
  net_pay numeric(14, 2) not null default 0,
  bank_snapshot jsonb not null default '{}'::jsonb,
  calculation_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_run_id, employee_id)
);

create table public.payroll_line_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  payroll_entry_id uuid not null references public.payroll_entries (id) on delete cascade,
  side text not null check (side in ('earning', 'deduction', 'employer_contribution')),
  code text not null,
  name text not null,
  amount numeric(14, 2) not null,
  is_statutory boolean not null default false,
  statutory_rule_set_id uuid references public.statutory_rule_sets (id),
  rule_snapshot jsonb not null default '{}'::jsonb
);

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  payroll_entry_id uuid not null unique references public.payroll_entries (id),
  employee_id uuid not null references public.employees (id),
  storage_path text,
  payment_date date,
  generated_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.employee_loans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  loan_type text not null check (loan_type in ('loan', 'salary_advance')),
  principal numeric(14, 2) not null check (principal > 0),
  interest_rate numeric(8, 4) not null default 0,
  start_date date not null,
  installment_amount numeric(14, 2) not null check (installment_amount > 0),
  term_months integer not null check (term_months > 0),
  balance numeric(14, 2) not null check (balance >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'active', 'closed', 'rejected', 'cancelled')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  loan_id uuid not null references public.employee_loans (id),
  payroll_entry_id uuid references public.payroll_entries (id),
  amount numeric(14, 2) not null check (amount > 0),
  paid_on date not null,
  created_at timestamptz not null default now()
);

create trigger loan_repayments_immutable
  before update or delete on public.loan_repayments
  for each row execute function private.reject_history_mutation();

create table public.benefit_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  category text not null,
  contribution_type text not null default 'fixed' check (contribution_type in ('fixed', 'percent')),
  employee_contribution numeric(14, 2) not null default 0,
  employer_contribution numeric(14, 2) not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employee_benefits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  benefit_plan_id uuid not null references public.benefit_plans (id),
  employee_id uuid not null references public.employees (id),
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select private.attach_triggers('statutory_rule_sets', 'payroll');
select private.attach_triggers('earning_types', 'payroll');
select private.attach_triggers('deduction_types', 'payroll');
select private.attach_triggers('employee_compensation', 'payroll');
select private.attach_triggers('employee_payroll_settings', 'payroll');
select private.attach_triggers('payroll_periods', 'payroll');
select private.attach_triggers('payroll_runs', 'payroll');
select private.attach_triggers('payroll_entries', 'payroll');
select private.attach_triggers('employee_loans', 'payroll');
select private.attach_triggers('benefit_plans', 'payroll');
select private.attach_triggers('employee_benefits', 'payroll');

create or replace function private.prevent_locked_rule_change()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'statutory_rule_sets' then
    if old.is_locked then
      raise exception 'This statutory rule set is locked because a payroll run used it. Create a new rule set for the next period.';
    end if;
    return coalesce(new, old);
  end if;

  if exists (
    select 1 from public.statutory_rule_sets s
    where s.id = coalesce(new.rule_set_id, old.rule_set_id)
      and s.is_locked
  ) then
    raise exception 'Brackets cannot change after the rule set has been used in payroll.';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger statutory_rule_sets_lock
  before update or delete on public.statutory_rule_sets
  for each row execute function private.prevent_locked_rule_change();

create trigger tax_brackets_lock
  before update or delete on public.tax_brackets
  for each row execute function private.prevent_locked_rule_change();

create or replace function private.prevent_locked_payroll_change()
returns trigger
language plpgsql
as $$
declare
  parent_status text;
  reopening boolean := coalesce(current_setting('app.payroll_reopen', true), '') = '1';
begin
  if tg_table_name = 'payroll_runs' then
    if old.status = 'paid' then
      raise exception 'A paid payroll run cannot be changed or reopened.';
    end if;

    if old.status in ('approved', 'locked') and not reopening then
      if old.status = 'approved' and new.status = 'locked'
        and new.totals is not distinct from old.totals
        and new.rules_snapshot is not distinct from old.rules_snapshot then
        return new;
      end if;
      if old.status = 'locked' and new.status = 'paid'
        and new.totals is not distinct from old.totals
        and new.rules_snapshot is not distinct from old.rules_snapshot then
        return new;
      end if;
      raise exception 'This payroll run is frozen. An authorized user must reopen it with a reason before figures can change.';
    end if;

    if not reopening then
      if not (
        (old.status = 'draft' and new.status in ('draft', 'calculated'))
        or (old.status = 'calculated' and new.status in ('calculated', 'reviewed', 'draft'))
        or (old.status = 'reviewed' and new.status in ('reviewed', 'approved', 'calculated'))
        or (old.status = 'approved' and new.status in ('approved', 'locked'))
        or (old.status = 'locked' and new.status = 'paid')
      ) then
        raise exception 'Payroll cannot move from % to %', old.status, new.status;
      end if;
    end if;

    return new;
  end if;

  if tg_table_name = 'payroll_entries' then
    select status into parent_status
    from public.payroll_runs
    where id = coalesce(new.payroll_run_id, old.payroll_run_id);
  else
    select r.status into parent_status
    from public.payroll_entries e
    join public.payroll_runs r on r.id = e.payroll_run_id
    where e.id = coalesce(new.payroll_entry_id, old.payroll_entry_id);
  end if;

  if parent_status in ('approved', 'locked', 'paid') and not reopening then
    raise exception 'Payroll figures are frozen once the run is approved.';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger payroll_runs_lock
  before update on public.payroll_runs
  for each row execute function private.prevent_locked_payroll_change();

create trigger payroll_entries_lock
  before update or delete on public.payroll_entries
  for each row execute function private.prevent_locked_payroll_change();

create trigger payroll_line_items_lock
  before update or delete on public.payroll_line_items
  for each row execute function private.prevent_locked_payroll_change();
