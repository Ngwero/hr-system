-- Employee relations, assets, expenses, letters, communications,
-- help desk, and offboarding.

create table public.disciplinary_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  incident_date date not null,
  category text not null,
  description text not null,
  evidence_path text,
  investigator_id uuid references public.employees (id),
  employee_response text,
  hearing_at timestamptz,
  decision text not null default 'pending'
    check (decision in (
      'pending', 'verbal_warning', 'written_warning', 'final_warning',
      'suspension', 'termination', 'no_action'
    )),
  status text not null default 'open' check (status in ('open', 'investigating', 'hearing', 'closed')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.grievances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  category text not null,
  complaint text not null,
  is_confidential boolean not null default true,
  assigned_to uuid references public.profiles (id),
  investigation text,
  action_taken text,
  resolution text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  asset_tag text not null,
  serial_number text,
  category text not null,
  name text not null,
  value numeric(14, 2),
  currency_code text,
  condition text,
  status text not null default 'in_stock'
    check (status in ('in_stock', 'assigned', 'repair', 'retired', 'lost')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, asset_tag)
);

create table public.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  asset_id uuid not null references public.assets (id),
  employee_id uuid not null references public.employees (id),
  assigned_at date not null default current_date,
  condition_out text,
  returned_at date,
  condition_in text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expense_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  title text not null,
  currency_code text not null,
  total numeric(14, 2) not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'paid', 'cancelled')),
  approval_request_id uuid references public.approval_requests (id),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.expense_claims (id) on delete cascade,
  category text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  currency_code text not null,
  spent_on date not null,
  description text,
  receipt_path text
);

create table public.travel_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  destination text not null,
  purpose text not null,
  start_date date not null,
  end_date date not null,
  allowance numeric(14, 2) not null default 0,
  accommodation numeric(14, 2) not null default 0,
  transport numeric(14, 2) not null default 0,
  advance_amount numeric(14, 2) not null default 0,
  currency_code text not null,
  reconciliation_notes text,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'reconciled', 'cancelled')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.letter_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  code text not null,
  name text not null,
  body text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.hr_letters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  template_id uuid references public.letter_templates (id),
  employee_id uuid references public.employees (id),
  subject text not null,
  body_rendered text not null,
  storage_path text,
  status text not null default 'draft' check (status in ('draft', 'issued', 'void')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  title text not null,
  body text not null,
  category text not null default 'announcement'
    check (category in ('policy', 'announcement', 'notice', 'event', 'urgent')),
  publish_at timestamptz,
  expires_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.announcement_targets (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  target_type text not null check (target_type in ('company', 'department', 'branch', 'role')),
  target_id uuid
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id),
  recipient_id uuid not null references public.profiles (id),
  title text not null,
  body text not null,
  channel text not null check (channel in ('in_app', 'email', 'sms')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'read', 'failed', 'skipped')),
  module text,
  record_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

create table public.notification_preferences (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  event_key text not null,
  in_app boolean not null default true,
  email boolean not null default true,
  sms boolean not null default false,
  primary key (profile_id, event_key)
);

create table public.hr_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  requester_id uuid not null references public.profiles (id),
  category text not null
    check (category in ('payroll', 'leave', 'benefits', 'documents', 'attendance', 'it_onboarding', 'other')),
  subject text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  assigned_to uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hr_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.hr_tickets (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.offboarding_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  kind text not null check (kind in ('resignation', 'termination', 'retirement', 'end_of_contract')),
  notice_date date,
  last_day date,
  reason text,
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'completed', 'cancelled')),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.offboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.offboarding_cases (id) on delete cascade,
  title text not null,
  owner_kind text not null check (owner_kind in ('hr', 'it', 'finance', 'manager', 'employee')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'waived')),
  completed_at timestamptz,
  sort_order integer not null default 1
);

create table public.exit_interviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  case_id uuid not null unique references public.offboarding_cases (id),
  reason text,
  satisfaction integer check (satisfaction is null or satisfaction between 1 and 5),
  manager_feedback text,
  culture_feedback text,
  compensation_feedback text,
  recommendation text,
  rehire_eligible boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select private.attach_triggers('disciplinary_cases', 'relations');
select private.attach_triggers('grievances', 'relations');
select private.attach_triggers('assets', 'assets');
select private.attach_triggers('asset_assignments', 'assets');
select private.attach_triggers('expense_claims', 'expenses');
select private.attach_triggers('travel_requests', 'expenses');
select private.attach_triggers('letter_templates', 'letters');
select private.attach_triggers('hr_letters', 'letters');
select private.attach_triggers('announcements', 'communications');
select private.attach_triggers('hr_tickets', 'helpdesk');
select private.attach_triggers('offboarding_cases', 'offboarding');
select private.attach_triggers('exit_interviews', 'offboarding');
