-- Recruitment, onboarding, performance, probation, training, and skills.

create table public.job_requisitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  position_title text not null,
  department_id uuid references public.departments (id),
  hiring_manager_id uuid references public.employees (id),
  vacancy_count integer not null default 1 check (vacancy_count > 0),
  employment_type text not null default 'permanent',
  budget_amount numeric(14, 2),
  currency_code text,
  reason text,
  is_replacement boolean not null default false,
  replacement_for uuid references public.employees (id),
  job_description text,
  qualifications text,
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'closed')),
  approval_request_id uuid references public.approval_requests (id),
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vacancies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  requisition_id uuid references public.job_requisitions (id),
  title text not null,
  department_id uuid references public.departments (id),
  positions integer not null default 1 check (positions > 0),
  status text not null default 'draft' check (status in ('draft', 'open', 'on_hold', 'closed', 'filled')),
  opened_at date,
  closed_at date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  full_name text not null,
  email text,
  phone text,
  source text,
  cv_path text,
  education jsonb not null default '[]'::jsonb,
  experience jsonb not null default '[]'::jsonb,
  skills text[] not null default '{}',
  rating numeric(3, 2),
  notes text,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  candidate_id uuid not null references public.candidates (id),
  vacancy_id uuid not null references public.vacancies (id),
  stage text not null default 'applied'
    check (stage in (
      'applied', 'screening', 'shortlisted', 'interview', 'assessment',
      'reference_check', 'offer', 'hired', 'rejected', 'withdrawn'
    )),
  rating numeric(3, 2),
  notes text,
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, vacancy_id)
);

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  application_id uuid not null references public.candidate_applications (id),
  scheduled_at timestamptz not null,
  location text,
  panel jsonb not null default '[]'::jsonb,
  recommendation text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interview_scores (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  interviewer_id uuid references public.employees (id),
  question text not null,
  score numeric(5, 2),
  comments text,
  created_at timestamptz not null default now()
);

create table public.job_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  application_id uuid not null references public.candidate_applications (id),
  salary numeric(14, 2) not null,
  currency_code text not null,
  benefits text,
  start_date date,
  position text not null,
  letter_path text,
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'sent', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.onboarding_template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.onboarding_templates (id) on delete cascade,
  title text not null,
  assignee_kind text not null check (assignee_kind in ('hr', 'it', 'finance', 'manager', 'employee')),
  sort_order integer not null default 1,
  is_required boolean not null default true
);

create table public.employee_onboarding (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  template_id uuid references public.onboarding_templates (id),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employee_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.employee_onboarding (id) on delete cascade,
  title text not null,
  assignee_kind text not null,
  assigned_to uuid references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  completed_at timestamptz,
  sort_order integer not null default 1
);

create table public.performance_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  cycle_type text not null check (cycle_type in ('monthly', 'quarterly', 'semi_annual', 'annual')),
  start_date date not null,
  end_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'goal_setting', 'self_review', 'manager_review', 'calibration', 'closed')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.performance_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  cycle_id uuid not null references public.performance_cycles (id),
  employee_id uuid not null references public.employees (id),
  title text not null,
  kpi text,
  target numeric(14, 2),
  actual numeric(14, 2),
  weight numeric(5, 2) not null default 0 check (weight >= 0 and weight <= 100),
  score numeric(5, 2),
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.competencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  category text,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  cycle_id uuid not null references public.performance_cycles (id),
  employee_id uuid not null references public.employees (id),
  reviewer_id uuid references public.employees (id),
  review_type text not null check (review_type in ('self', 'manager', 'calibration', 'final')),
  rating numeric(4, 2),
  feedback text,
  development_plan text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'final')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.review_competency_ratings (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.performance_reviews (id) on delete cascade,
  competency_id uuid not null references public.competencies (id),
  required_level integer,
  actual_level integer,
  comments text,
  unique (review_id, competency_id)
);

create table public.probation_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  review_type text not null check (review_type in ('mid', 'final')),
  outcome text not null default 'pending'
    check (outcome in ('pending', 'confirmed', 'extended', 'terminated')),
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  category text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.employee_skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  skill_id uuid not null references public.skills (id),
  required_level integer,
  actual_level integer,
  proficiency text,
  certified_until date,
  updated_at timestamptz not null default now(),
  unique (employee_id, skill_id)
);

create table public.training_courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  title text not null,
  provider text,
  cost numeric(14, 2) not null default 0,
  currency_code text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  course_id uuid not null references public.training_courses (id),
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity integer,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions (id) on delete cascade,
  employee_id uuid not null references public.employees (id),
  status text not null default 'registered'
    check (status in ('registered', 'attended', 'completed', 'absent')),
  certificate_path text,
  certificate_expires_at date,
  unique (session_id, employee_id)
);

create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  employee_id uuid not null references public.employees (id),
  name text not null,
  issuer text,
  issued_on date,
  expires_on date,
  document_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select private.attach_triggers('job_requisitions', 'recruitment');
select private.attach_triggers('vacancies', 'recruitment');
select private.attach_triggers('candidates', 'recruitment');
select private.attach_triggers('candidate_applications', 'recruitment');
select private.attach_triggers('interviews', 'recruitment');
select private.attach_triggers('job_offers', 'recruitment');
select private.attach_triggers('onboarding_templates', 'onboarding');
select private.attach_triggers('employee_onboarding', 'onboarding');
select private.attach_triggers('performance_cycles', 'performance');
select private.attach_triggers('performance_goals', 'performance');
select private.attach_triggers('competencies', 'performance');
select private.attach_triggers('performance_reviews', 'performance');
select private.attach_triggers('probation_reviews', 'performance');
select private.attach_triggers('skills', 'training');
select private.attach_triggers('employee_skills', 'training');
select private.attach_triggers('training_courses', 'training');
select private.attach_triggers('training_sessions', 'training');
select private.attach_triggers('certifications', 'training');
