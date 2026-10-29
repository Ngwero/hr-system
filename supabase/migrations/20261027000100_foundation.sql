-- Foundation: private helpers, audit, and request context.
-- Business rules live in the database so the UI cannot bypass them.

create extension if not exists pgcrypto;

create schema if not exists private;

comment on schema private is
  'Security-definer helpers. Not exposed as a PostgREST API schema.';

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.mask_account(p_value text)
returns text
language sql
immutable
as $$
  select case
    when p_value is null or length(p_value) < 4 then '••••'
    else repeat('•', greatest(length(p_value) - 4, 0)) || right(p_value, 4)
  end;
$$;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  actor_id uuid,
  action text not null,
  module text not null,
  table_name text not null,
  record_id text,
  previous_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx
  on public.audit_logs (organization_id, created_at desc);

create index audit_logs_record_idx
  on public.audit_logs (table_name, record_id);

comment on table public.audit_logs is
  'Append-only record of security-sensitive changes. Application roles cannot update or delete these rows.';

create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_org uuid;
  v_id text;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_new := null;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    if v_old = v_new then
      return new;
    end if;
  else
    v_old := null;
    v_new := to_jsonb(new);
  end if;

  if tg_table_name = 'employee_bank_accounts' then
    if v_old ? 'account_number' then
      v_old := jsonb_set(v_old, '{account_number}', to_jsonb(private.mask_account(v_old->>'account_number')));
    end if;
    if v_new ? 'account_number' then
      v_new := jsonb_set(v_new, '{account_number}', to_jsonb(private.mask_account(v_new->>'account_number')));
    end if;
  end if;

  if tg_table_name = 'employee_identifications' then
    if v_old ? 'document_number' then
      v_old := jsonb_set(v_old, '{document_number}', to_jsonb(private.mask_account(v_old->>'document_number')));
    end if;
    if v_new ? 'document_number' then
      v_new := jsonb_set(v_new, '{document_number}', to_jsonb(private.mask_account(v_new->>'document_number')));
    end if;
  end if;

  v_org := nullif(coalesce(v_new->>'organization_id', v_old->>'organization_id'), '')::uuid;
  v_id := coalesce(v_new->>'id', v_old->>'id');

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    module,
    table_name,
    record_id,
    previous_value,
    new_value,
    ip_address,
    user_agent
  ) values (
    v_org,
    auth.uid(),
    lower(tg_op),
    coalesce(tg_argv[0], 'system'),
    tg_table_name,
    v_id,
    v_old,
    v_new,
    nullif(current_setting('app.client_ip', true), ''),
    nullif(left(current_setting('app.user_agent', true), 500), '')
  );

  return coalesce(new, old);
end;
$$;

create or replace function private.attach_triggers(p_table text, p_module text)
returns void
language plpgsql
as $$
begin
  execute format('drop trigger if exists %I on public.%I', p_table || '_touch', p_table);
  execute format(
    'create trigger %I before update on public.%I for each row execute function private.touch_updated_at()',
    p_table || '_touch',
    p_table
  );
  execute format('drop trigger if exists %I on public.%I', p_table || '_audit', p_table);
  execute format(
    'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row(%L)',
    p_table || '_audit',
    p_table,
    p_module
  );
end;
$$;

-- Called by the Next.js server before mutations so audit rows keep the caller IP.
create or replace function public.set_request_context(p_ip text, p_user_agent text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  perform set_config('app.client_ip', coalesce(p_ip, ''), true);
  perform set_config('app.user_agent', coalesce(p_user_agent, ''), true);
end;
$$;

create table public.login_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  ip_address text,
  success boolean not null,
  created_at timestamptz not null default now()
);

create index login_attempts_email_created_idx
  on public.login_attempts (lower(email), created_at desc);

comment on table public.login_attempts is
  'Sign-in throttle log. Only the service role can read or write it.';
