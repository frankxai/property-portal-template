-- Tenant-scoped, hashed renter portal access for existing v0.2 databases.
-- Apply after db/004-tenant-oidc.sql, then rerun db/rls.sql.
-- Access codes are generated server-side and only their SHA-256 digests are persisted.

begin;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_id_organization_unique') then
    alter table properties
      add constraint properties_id_organization_unique unique (id, organization_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'units_id_property_unique') then
    alter table units
      add constraint units_id_property_unique unique (id, property_id);
  end if;
end $$;

create table if not exists renter_access_grants (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  property_id text not null,
  unit_id text,
  rental_label text check (rental_label is null or length(rental_label) between 1 and 160),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint renter_access_grants_property_tenant_fk
    foreign key (property_id, organization_id)
    references properties(id, organization_id) on delete cascade,
  constraint renter_access_grants_unit_property_fk
    foreign key (unit_id, property_id)
    references units(id, property_id) on delete cascade,
  check (expires_at > created_at),
  check ((revoked_at is null) = (revoked_by is null))
);

create index if not exists renter_access_grants_org_property_idx
  on renter_access_grants (organization_id, property_id, created_at desc);
create index if not exists renter_access_grants_active_expiry_idx
  on renter_access_grants (organization_id, expires_at)
  where revoked_at is null;
create index if not exists audit_events_renter_access_idx
  on audit_events (organization_id, subject_id, created_at desc)
  where subject_type = 'renter_access_grant';

alter table renter_access_grants enable row level security;
alter table renter_access_grants force row level security;

drop policy if exists renter_access_grants_tenant_isolation on renter_access_grants;
create policy renter_access_grants_tenant_isolation on renter_access_grants
  for all
  using (organization_id = property_os_current_organization_id())
  with check (
    organization_id = property_os_current_organization_id()
    and property_os_property_in_current_org(property_id)
  );

commit;
