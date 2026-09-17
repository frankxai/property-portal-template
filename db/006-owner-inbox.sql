-- Owner Inbox workflow overlay for existing inquiry and support intake records.
-- Apply after db/schema.sql and db/rls.sql. Intake tables and intake writes are unchanged.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organization_members_id_organization_unique'
      and conrelid = 'organization_members'::regclass
  ) then
    alter table organization_members
      add constraint organization_members_id_organization_unique unique (id, organization_id);
  end if;
end $$;

create table if not exists owner_inbox_work_items (
  organization_id text not null references organizations(id) on delete cascade,
  source_type text not null check (source_type in ('inquiry', 'support')),
  source_id text not null,
  status text not null default 'new' check (status in ('new', 'triage', 'in-progress', 'waiting-owner', 'resolved', 'closed')),
  assignee_member_id text,
  due_at timestamptz,
  draft_reply text not null default '' check (length(draft_reply) <= 8000),
  draft_approval_state text not null default 'none' check (draft_approval_state in ('none', 'draft', 'pending', 'approved', 'changes-requested')),
  version integer not null default 1 check (version > 0),
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, source_type, source_id),
  constraint owner_inbox_assignee_tenant_fk
    foreign key (assignee_member_id, organization_id)
    references organization_members(id, organization_id) on delete restrict
);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'owner_inbox_work_items_assignee_member_id_fkey'
      and conrelid = 'owner_inbox_work_items'::regclass
  ) then
    alter table owner_inbox_work_items
      drop constraint owner_inbox_work_items_assignee_member_id_fkey;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'owner_inbox_assignee_tenant_fk'
      and conrelid = 'owner_inbox_work_items'::regclass
  ) then
    alter table owner_inbox_work_items
      add constraint owner_inbox_assignee_tenant_fk
      foreign key (assignee_member_id, organization_id)
      references organization_members(id, organization_id) on delete restrict;
  end if;
end $$;

create table if not exists owner_inbox_events (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  source_type text not null check (source_type in ('inquiry', 'support')),
  source_id text not null,
  actor_id text not null,
  actor_role text not null check (actor_role in ('owner', 'agency-admin', 'manager')),
  event_type text not null check (event_type in ('triaged', 'assigned', 'due-date-set', 'draft-updated', 'approval-updated', 'status-changed', 'updated')),
  from_status text check (from_status is null or from_status in ('new', 'triage', 'in-progress', 'waiting-owner', 'resolved', 'closed')),
  to_status text check (to_status is null or to_status in ('new', 'triage', 'in-progress', 'waiting-owner', 'resolved', 'closed')),
  version integer not null check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists owner_inbox_work_queue_idx
  on owner_inbox_work_items (organization_id, status, due_at, updated_at desc);
create index if not exists owner_inbox_events_timeline_idx
  on owner_inbox_events (organization_id, source_type, source_id, occurred_at desc);

create or replace function property_os_owner_inbox_events_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'owner_inbox_events is append-only';
end $$;

create or replace function property_os_owner_inbox_source_belongs_to_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.source_type = 'inquiry' and not exists (
    select 1 from inquiries
    where id = new.source_id and organization_id = new.organization_id
  ) then
    raise exception 'Owner inbox inquiry source does not belong to organization';
  end if;
  if new.source_type = 'support' and not exists (
    select 1 from support_tickets
    where id = new.source_id and organization_id = new.organization_id
  ) then
    raise exception 'Owner inbox support source does not belong to organization';
  end if;
  return new;
end $$;

drop trigger if exists owner_inbox_events_append_only on owner_inbox_events;
create trigger owner_inbox_events_append_only
before update or delete on owner_inbox_events
for each row execute function property_os_owner_inbox_events_append_only();

drop trigger if exists owner_inbox_work_item_source_tenant on owner_inbox_work_items;
create trigger owner_inbox_work_item_source_tenant
before insert or update on owner_inbox_work_items
for each row execute function property_os_owner_inbox_source_belongs_to_tenant();

drop trigger if exists owner_inbox_event_source_tenant on owner_inbox_events;
create trigger owner_inbox_event_source_tenant
before insert on owner_inbox_events
for each row execute function property_os_owner_inbox_source_belongs_to_tenant();

alter table owner_inbox_work_items enable row level security;
alter table owner_inbox_work_items force row level security;
alter table owner_inbox_events enable row level security;
alter table owner_inbox_events force row level security;

drop policy if exists owner_inbox_work_items_tenant_isolation on owner_inbox_work_items;
create policy owner_inbox_work_items_tenant_isolation on owner_inbox_work_items
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists owner_inbox_events_tenant_select on owner_inbox_events;
create policy owner_inbox_events_tenant_select on owner_inbox_events
  for select
  using (organization_id = property_os_current_organization_id());

drop policy if exists owner_inbox_events_tenant_insert on owner_inbox_events;
create policy owner_inbox_events_tenant_insert on owner_inbox_events
  for insert
  with check (organization_id = property_os_current_organization_id());

insert into property_os_schema_versions (component, version)
values ('owner-inbox', '006')
on conflict (component) do update
set version = excluded.version, applied_at = now();
