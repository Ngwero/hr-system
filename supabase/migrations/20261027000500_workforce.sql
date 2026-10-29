-- Attendance, shifts, leave, and the configurable approval engine.

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  code text not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 60 check (break_minutes >= 0),
  grace_minutes integer not null default 0 check (grace_minutes >= 0),
  working_hours numeric(4, 2) not null check (working_hours > 0),
  is_night boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  shift_id uuid not null references public.shifts (id),
  employee_id uuid not null references public.employees (id),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  work_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  location_id uuid references public.locations (id),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  source text not null default 'manual'
    check (source in ('manual', 'hr', 'supervisor', 'qr', 'biometric', 'gps')),
  hours_worked numeric(6, 2),
  late_minutes integer not null default 0,
  early_departure_minutes integer not null default 0,
  overtime_minutes integer not null default 0,
  break_minutes integer not null default 0,
  shift_id uuid references public.shifts (id),
  status text not null default 'present'
    check (status in ('present', 'late', 'absent', 'leave', 'holiday', 'off_day', 'remote', 'business_travel')),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_id, work_date)
);

create table public.overtime_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  work_date date not null,
  minutes integer not null check (minutes > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  period_start date not null,
  period_end date not null,
  total_hours numeric(8, 2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  code text not null,
  name text not null,
  paid boolean not null default true,
  requires_document boolean not null default false,
  gender_restriction text not null default 'any' check (gender_restriction in ('any', 'female', 'male')),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.approval_workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  code text not null,
  name text not null,
  entity_type text not null,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.approval_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.approval_workflows (id) on delete cascade,
  step_order integer not null check (step_order > 0),
  approver_kind text not null check (approver_kind in ('direct_manager', 'org_permission', 'role')),
  role_code text,
  permission_code text,
  unique (workflow_id, step_order),
  check (
    (approver_kind = 'direct_manager' and role_code is null and permission_code is null)
    or (approver_kind = 'org_permission' and permission_code is not null)
    or (approver_kind = 'role' and role_code is not null)
  )
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  workflow_id uuid not null references public.approval_workflows (id),
  entity_type text not null,
  entity_id uuid not null,
  requester_id uuid not null references public.profiles (id),
  current_step integer not null default 1,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index approval_requests_org_status_idx
  on public.approval_requests (organization_id, status);

create table public.approval_actions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.approval_requests (id) on delete cascade,
  step_order integer not null,
  actor_id uuid not null references public.profiles (id),
  decision text not null check (decision in ('approved', 'rejected', 'returned')),
  comment text,
  acted_at timestamptz not null default now()
);

create trigger approval_actions_immutable
  before update or delete on public.approval_actions
  for each row execute function private.reject_history_mutation();

create table public.leave_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  leave_type_id uuid not null references public.leave_types (id),
  days_entitled numeric(6, 2) not null default 0,
  carry_forward boolean not null default false,
  max_carry_forward numeric(6, 2) not null default 0,
  accrual_method text not null default 'annual_grant'
    check (accrual_method in ('annual_grant', 'monthly_accrual')),
  accrual_days_per_month numeric(6, 3) not null default 0,
  min_service_days integer not null default 0,
  counts_public_holidays boolean not null default false,
  approval_workflow_id uuid references public.approval_workflows (id),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  leave_type_id uuid not null references public.leave_types (id),
  leave_year integer not null,
  entitled numeric(6, 2) not null default 0,
  carried_forward numeric(6, 2) not null default 0,
  used numeric(6, 2) not null default 0,
  pending numeric(6, 2) not null default 0,
  remaining numeric(6, 2) generated always as (entitled + carried_forward - used - pending) stored,
  updated_at timestamptz not null default now(),
  unique (employee_id, leave_type_id, leave_year)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  leave_type_id uuid not null references public.leave_types (id),
  start_date date not null,
  end_date date not null,
  days numeric(6, 2) not null check (days > 0),
  reason text,
  document_path text,
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
  approval_request_id uuid references public.approval_requests (id),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index leave_requests_employee_idx on public.leave_requests (employee_id, start_date, end_date);

select private.attach_triggers('shifts', 'attendance');
select private.attach_triggers('shift_assignments', 'attendance');
select private.attach_triggers('attendance', 'attendance');
select private.attach_triggers('overtime_requests', 'attendance');
select private.attach_triggers('timesheets', 'attendance');
select private.attach_triggers('leave_types', 'leave');
select private.attach_triggers('leave_policies', 'leave');
select private.attach_triggers('leave_balances', 'leave');
select private.attach_triggers('leave_requests', 'leave');
select private.attach_triggers('approval_workflows', 'approvals');
select private.attach_triggers('approval_requests', 'approvals');
