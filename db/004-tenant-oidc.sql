-- Agency identity upgrade for existing v0.2 portal databases.
-- Pinned to Better Auth 1.6.23. Apply after 003-weekly-owner-review.sql, then rerun db/rls.sql.
-- This migration does not bind legacy members. Bind reviewed issuer/subject values separately.

begin;

lock table organization_members in share row exclusive mode;

alter table organization_members add column if not exists identity_issuer text;
alter table organization_members add column if not exists identity_subject text;
alter table organization_members add column if not exists status text not null default 'active';
alter table organization_members add column if not exists last_authenticated_at timestamptz;
alter table organization_members add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organization_members_status_check') then
    alter table organization_members
      add constraint organization_members_status_check check (status in ('active', 'revoked'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organization_members_identity_pair_check') then
    alter table organization_members
      add constraint organization_members_identity_pair_check
      check ((identity_issuer is null) = (identity_subject is null));
  end if;
  if exists (
    select 1
    from organization_members
    where identity_issuer is not null and identity_subject is not null
    group by organization_id, identity_issuer, identity_subject
    having count(*) > 1
  ) then
    raise exception 'Duplicate organization/issuer/subject memberships must be resolved before OIDC activation';
  end if;
end $$;

drop index if exists organization_members_identity_idx;
create unique index organization_members_identity_idx
  on organization_members (organization_id, identity_issuer, identity_subject)
  where identity_issuer is not null and identity_subject is not null;

create table if not exists auth_users (
  id text primary key,
  name text not null,
  email text not null unique,
  email_verified boolean not null default false,
  image_url text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists auth_sessions (
  id text primary key,
  expires_at timestamptz not null,
  token text not null unique,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  ip_address text,
  user_agent text,
  user_id text not null references auth_users(id) on delete cascade
);

create index if not exists auth_sessions_user_id_idx on auth_sessions (user_id);
create index if not exists auth_sessions_expires_at_idx on auth_sessions (expires_at);

create table if not exists auth_accounts (
  id text primary key,
  account_id text not null,
  provider_id text not null,
  user_id text not null references auth_users(id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (provider_id, account_id)
);

create index if not exists auth_accounts_user_id_idx on auth_accounts (user_id);

create table if not exists auth_verifications (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists auth_verifications_identifier_idx on auth_verifications (identifier);
create index if not exists auth_verifications_expires_at_idx on auth_verifications (expires_at);

create table if not exists auth_rate_limits (
  id text primary key,
  key text not null unique,
  count integer not null,
  last_request bigint not null
);

create table if not exists property_os_schema_versions (
  component text primary key,
  version text not null,
  applied_at timestamptz not null default now()
);

create or replace function property_os_bind_oidc_member(
  target_organization_id text,
  target_email text,
  target_identity_issuer text,
  target_identity_subject text,
  target_role text
)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  member_id text;
  current_issuer text;
  current_subject text;
begin
  if target_role not in ('owner', 'agency-admin', 'manager') then
    raise exception 'OIDC member role is not authorized';
  end if;
  if nullif(btrim(target_identity_issuer), '') is null or nullif(btrim(target_identity_subject), '') is null then
    raise exception 'OIDC issuer and subject are required';
  end if;

  select id, identity_issuer, identity_subject
  into member_id, current_issuer, current_subject
  from organization_members
  where organization_id = target_organization_id
    and lower(email) = lower(target_email)
    and role = target_role
    and status = 'active'
  for update;

  if member_id is null then
    raise exception 'No active member matches the reviewed organization, email, and role';
  end if;
  if current_issuer is not null and (current_issuer <> target_identity_issuer or current_subject <> target_identity_subject) then
    raise exception 'Member is already bound to another immutable identity';
  end if;

  update organization_members
  set identity_issuer = target_identity_issuer,
      identity_subject = target_identity_subject,
      updated_at = now()
  where id = member_id;

  return member_id;
end $$;

revoke all on function property_os_bind_oidc_member(text, text, text, text, text) from public;


do $$
declare
  required_column record;
begin
  for required_column in
    select * from (values
      ('auth_users', 'email_verified'),
      ('auth_sessions', 'user_id'),
      ('auth_sessions', 'expires_at'),
      ('auth_accounts', 'account_id'),
      ('auth_accounts', 'provider_id'),
      ('auth_verifications', 'identifier'),
      ('auth_rate_limits', 'last_request')
    ) as required(table_name, column_name)
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = current_schema()
        and table_name = required_column.table_name
        and column_name = required_column.column_name
    ) then
      raise exception 'OIDC auth schema drift: %.% is missing', required_column.table_name, required_column.column_name;
    end if;
  end loop;
end $$;

insert into property_os_schema_versions (component, version, applied_at)
values ('better-auth', '1.6.23-property-os.1', now())
on conflict (component) do update
set version = excluded.version, applied_at = excluded.applied_at;

commit;
