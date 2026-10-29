-- Employee master data.
-- Work profile, personal data, identity documents, bank details, and salary
-- are separate tables so a directory user cannot read a neighbour's pay or ID.

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  profile_id uuid references public.profiles (id),
  employee_number text not null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  preferred_name text,
  photo_path text,
  work_email text,
  work_phone text,
  extension text,
  employment_status text not null default 'active'
    check (employment_status in ('active', 'probation', 'confirmed', 'suspended', 'on_leave', 'exited', 'archived')),
  employment_type text not null default 'permanent'
    check (employment_type in ('permanent', 'contract', 'temporary', 'intern', 'casual', 'consultant')),
  job_title_id uuid references public.job_titles (id),
  job_grade_id uuid references public.job_grades (id),
  department_id uuid references public.departments (id),
  business_unit_id uuid references public.business_units (id),
  branch_id uuid references public.branches (id),
  location_id uuid references public.locations (id),
  cost_centre_id uuid references public.cost_centres (id),
  team_id uuid references public.teams (id),
  supervisor_id uuid references public.employees (id),
  hire_date date,
  confirmation_date date,
  contract_start date,
  contract_end date,
  probation_end date,
  notice_period_days integer check (notice_period_days is null or notice_period_days >= 0),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_number)
);

create index employees_org_status_idx on public.employees (organization_id, employment_status);
create index employees_department_idx on public.employees (department_id);
create index employees_supervisor_idx on public.employees (supervisor_id);
create index employees_profile_idx on public.employees (profile_id);

create table public.employee_personal (
  employee_id uuid primary key references public.employees (id) on delete cascade,
  organization_id uuid not null references public.organizations (id),
  gender text check (gender is null or gender in ('female', 'male', 'other', 'undisclosed')),
  date_of_birth date,
  nationality text,
  marital_status text,
  personal_email text,
  mobile_number text,
  alternative_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country_code text,
  updated_at timestamptz not null default now()
);

create table public.employee_identifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id) on delete cascade,
  id_type text not null,
  document_number text not null,
  issuing_country text,
  issued_on date,
  expires_on date,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employee_emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id) on delete cascade,
  full_name text not null,
  relationship text not null,
  phone text not null,
  alternative_phone text,
  address text,
  is_next_of_kin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employee_dependants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id) on delete cascade,
  full_name text not null,
  relationship text not null,
  date_of_birth date,
  contact text,
  benefit_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employee_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id) on delete cascade,
  bank_name text not null,
  branch_name text,
  account_name text not null,
  account_number text not null,
  mobile_money_provider text,
  mobile_money_number text,
  is_primary boolean not null default true,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id) on delete cascade,
  document_type text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  issue_date date,
  expiry_date date,
  confidentiality text not null default 'confidential'
    check (confidentiality in ('standard', 'confidential', 'restricted')),
  version integer not null default 1,
  status text not null default 'active' check (status in ('active', 'expired', 'archived')),
  uploaded_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index employee_documents_expiry_idx
  on public.employee_documents (organization_id, expiry_date)
  where deleted_at is null and expiry_date is not null;

create table public.employment_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  change_type text not null,
  effective_date date not null,
  reason text,
  previous_value jsonb,
  new_value jsonb,
  approved_by uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.id_card_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  orientation text not null default 'portrait' check (orientation in ('portrait', 'landscape')),
  front_layout jsonb not null default '{}'::jsonb,
  back_layout jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.id_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  template_id uuid references public.id_card_templates (id),
  card_number text not null,
  qr_token uuid not null default gen_random_uuid(),
  issued_at date not null default current_date,
  expires_at date,
  status text not null default 'active'
    check (status in ('active', 'expired', 'lost', 'replaced', 'suspended')),
  replaced_by_id uuid references public.id_cards (id),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, card_number),
  unique (qr_token)
);

select private.attach_triggers('employees', 'people');
select private.attach_triggers('employee_personal', 'people');
select private.attach_triggers('employee_identifications', 'people');
select private.attach_triggers('employee_emergency_contacts', 'people');
select private.attach_triggers('employee_dependants', 'people');
select private.attach_triggers('employee_bank_accounts', 'people');
select private.attach_triggers('employee_documents', 'people');
select private.attach_triggers('id_card_templates', 'people');
select private.attach_triggers('id_cards', 'people');

-- Employment history is insert-only. Updates would rewrite the career record.
create or replace function private.reject_history_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% records are immutable', tg_table_name;
end;
$$;

create trigger employment_history_immutable
  before update or delete on public.employment_history
  for each row execute function private.reject_history_mutation();

create trigger employment_history_audit
  after insert on public.employment_history
  for each row execute function private.audit_row('people');
