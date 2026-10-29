-- Multi-company organisation structure.
-- One product database can hold a company and its subsidiaries.
-- V1 may operate a single company; nothing here assumes that.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  parent_organization_id uuid references public.organizations (id),
  org_type text not null default 'company' check (org_type in ('company', 'subsidiary')),
  legal_name text not null check (char_length(legal_name) between 2 and 200),
  trading_name text,
  registration_number text,
  tax_number text,
  logo_path text,
  email text,
  phone text,
  website text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country_code text not null default 'UG' check (country_code ~ '^[A-Z]{2}$'),
  currency_code text not null default 'UGX' check (currency_code ~ '^[A-Z]{3}$'),
  timezone text not null default 'Africa/Kampala',
  date_format text not null default 'dd MMM yyyy',
  time_format text not null default 'HH:mm' check (time_format in ('HH:mm', 'h:mm a')),
  fiscal_year_start_month integer not null default 1 check (fiscal_year_start_month between 1 and 12),
  leave_year_start_month integer not null default 1 check (leave_year_start_month between 1 and 12),
  payroll_frequency text not null default 'monthly'
    check (payroll_frequency in ('monthly', 'weekly', 'biweekly', 'custom')),
  working_hours_per_day numeric(4, 2) not null default 8 check (working_hours_per_day > 0 and working_hours_per_day <= 24),
  week_start smallint not null default 1 check (week_start between 0 and 6),
  primary_color text not null default '#0f3d4c',
  accent_color text not null default '#0f766e',
  employee_number_prefix text not null default 'EMP-',
  employee_number_padding integer not null default 5 check (employee_number_padding between 3 and 10),
  document_number_prefix text not null default 'DOC-',
  payroll_number_prefix text not null default 'PAY-',
  mfa_required boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizations_parent_idx on public.organizations (parent_organization_id);

create table public.working_days (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_working boolean not null default true,
  start_time time not null default '08:00',
  end_time time not null default '17:00',
  primary key (organization_id, weekday),
  check (end_time > start_time)
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  code text not null check (char_length(code) between 1 and 32),
  name text not null,
  email text,
  phone text,
  address_line1 text,
  city text,
  state_region text,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  timezone text,
  is_head_office boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  branch_id uuid references public.branches (id),
  code text not null,
  name text not null,
  address_line1 text,
  city text,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  timezone text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  code text not null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.business_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  division_id uuid references public.divisions (id),
  code text not null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.cost_centres (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  parent_id uuid references public.cost_centres (id),
  code text not null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  branch_id uuid references public.branches (id),
  business_unit_id uuid references public.business_units (id),
  parent_department_id uuid references public.departments (id),
  cost_centre_id uuid references public.cost_centres (id),
  code text not null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  department_id uuid references public.departments (id),
  code text not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.job_grades (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  code text not null,
  name text not null,
  level integer not null default 1,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

-- Salary bands are separate so directory users can see a grade name
-- without being able to read the pay range.
create table public.job_grade_bands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  job_grade_id uuid not null references public.job_grades (id),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  minimum_salary numeric(14, 2) not null,
  midpoint_salary numeric(14, 2),
  maximum_salary numeric(14, 2) not null,
  effective_from date not null,
  effective_to date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (maximum_salary >= minimum_salary),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.job_titles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  job_grade_id uuid references public.job_grades (id),
  code text not null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.public_holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  branch_id uuid references public.branches (id),
  location_id uuid references public.locations (id),
  name text not null,
  holiday_date date not null,
  is_recurring boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index public_holidays_date_idx
  on public.public_holidays (organization_id, holiday_date);

create table public.number_sequences (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sequence_key text not null,
  prefix text not null,
  next_value bigint not null default 1 check (next_value > 0),
  padding integer not null default 5 check (padding between 3 and 10),
  primary key (organization_id, sequence_key)
);

select private.attach_triggers('organizations', 'organization');
select private.attach_triggers('branches', 'organization');
select private.attach_triggers('locations', 'organization');
select private.attach_triggers('divisions', 'organization');
select private.attach_triggers('business_units', 'organization');
select private.attach_triggers('cost_centres', 'organization');
select private.attach_triggers('departments', 'organization');
select private.attach_triggers('teams', 'organization');
select private.attach_triggers('job_grades', 'organization');
select private.attach_triggers('job_grade_bands', 'organization');
select private.attach_triggers('job_titles', 'organization');
select private.attach_triggers('public_holidays', 'organization');
