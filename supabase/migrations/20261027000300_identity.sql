-- Identity, membership, and permission-based access.
-- Role names are labels. Access decisions use permission codes.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  active_organization_id uuid references public.organizations (id),
  full_name text not null check (char_length(full_name) between 1 and 160),
  email text not null,
  phone text,
  avatar_path text,
  is_platform_admin boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended', 'archived')),
  mfa_required boolean not null default false,
  last_sign_in_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_idx on public.profiles (lower(email));

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null references public.profiles (id),
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  is_primary boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  module text not null,
  description text not null
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  code text not null,
  name text not null,
  description text,
  is_system boolean not null default true,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.role_permission_templates (
  role_code text not null,
  permission_code text not null references public.permissions (code) on delete cascade,
  primary key (role_code, permission_code)
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null references public.profiles (id),
  role_id uuid not null references public.roles (id),
  scope_type text not null default 'organization'
    check (scope_type in ('organization', 'branch', 'department', 'team', 'direct_reports', 'self')),
  scope_id uuid,
  status text not null default 'active' check (status in ('active', 'inactive')),
  granted_by uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope_type in ('organization', 'direct_reports', 'self') and scope_id is null)
    or (scope_type in ('branch', 'department', 'team') and scope_id is not null)
  )
);

create unique index user_roles_assignment_idx
  on public.user_roles (organization_id, user_id, role_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index user_roles_user_idx on public.user_roles (user_id, organization_id);

select private.attach_triggers('profiles', 'identity');
select private.attach_triggers('organization_members', 'identity');
select private.attach_triggers('roles', 'identity');
select private.attach_triggers('user_roles', 'identity');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, 'User'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Privileged profile columns cannot be changed by a normal client update.
create or replace function private.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.allow_profile_admin', true), '') = '1' then
    return new;
  end if;

  new.is_platform_admin := old.is_platform_admin;
  new.status := old.status;
  new.email := old.email;
  new.active_organization_id := old.active_organization_id;
  new.deleted_at := old.deleted_at;
  return new;
end;
$$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect
  before update on public.profiles
  for each row execute function private.protect_profile();

create or replace function private.prevent_system_role_rewrite()
returns trigger
language plpgsql
as $$
begin
  if old.is_system and new.code is distinct from old.code then
    raise exception 'System role codes cannot be renamed';
  end if;
  if old.is_system and new.organization_id is distinct from old.organization_id then
    raise exception 'System roles cannot move between organizations';
  end if;
  if old.is_system and new.is_system is distinct from old.is_system then
    raise exception 'System roles stay system roles';
  end if;
  return new;
end;
$$;

drop trigger if exists roles_protect_system on public.roles;
create trigger roles_protect_system
  before update on public.roles
  for each row execute function private.prevent_system_role_rewrite();
