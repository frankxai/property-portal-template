-- Property Intelligence OS tenant isolation policies.
-- Apply after db/schema.sql when using Postgres for real runtime data.
-- The app sets property_os.organization_id per transaction before reading or writing.

create or replace function property_os_current_organization_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('property_os.organization_id', true), '')
$$;

create or replace function property_os_property_in_current_org(target_property_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from properties
    where id = target_property_id
      and organization_id = property_os_current_organization_id()
  )
$$;

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table properties enable row level security;
alter table units enable row level security;
alter table knowledge_articles enable row level security;
alter table listing_drafts enable row level security;
alter table inquiries enable row level security;
alter table support_tickets enable row level security;
alter table approvals enable row level security;
alter table agent_runs enable row level security;
alter table agent_missions enable row level security;
alter table resource_versions enable row level security;
alter table transition_proposals enable row level security;
alter table approval_receipts enable row level security;
alter table controlled_transitions enable row level security;
alter table audit_events enable row level security;

alter table organizations force row level security;
alter table organization_members force row level security;
alter table properties force row level security;
alter table units force row level security;
alter table knowledge_articles force row level security;
alter table listing_drafts force row level security;
alter table inquiries force row level security;
alter table support_tickets force row level security;
alter table approvals force row level security;
alter table agent_runs force row level security;
alter table agent_missions force row level security;
alter table resource_versions force row level security;
alter table transition_proposals force row level security;
alter table approval_receipts force row level security;
alter table controlled_transitions force row level security;
alter table audit_events force row level security;

drop policy if exists organizations_tenant_isolation on organizations;
create policy organizations_tenant_isolation on organizations
  for all
  using (id = property_os_current_organization_id())
  with check (id = property_os_current_organization_id());

drop policy if exists organization_members_tenant_isolation on organization_members;
create policy organization_members_tenant_isolation on organization_members
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists properties_tenant_isolation on properties;
create policy properties_tenant_isolation on properties
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists inquiries_tenant_isolation on inquiries;
create policy inquiries_tenant_isolation on inquiries
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists support_tickets_tenant_isolation on support_tickets;
create policy support_tickets_tenant_isolation on support_tickets
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists approvals_tenant_isolation on approvals;
create policy approvals_tenant_isolation on approvals
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists agent_runs_tenant_isolation on agent_runs;
create policy agent_runs_tenant_isolation on agent_runs
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists agent_missions_tenant_isolation on agent_missions;
create policy agent_missions_tenant_isolation on agent_missions
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists resource_versions_tenant_isolation on resource_versions;
create policy resource_versions_tenant_isolation on resource_versions
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists transition_proposals_tenant_isolation on transition_proposals;
create policy transition_proposals_tenant_isolation on transition_proposals
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists approval_receipts_tenant_isolation on approval_receipts;
create policy approval_receipts_tenant_isolation on approval_receipts
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists controlled_transitions_tenant_isolation on controlled_transitions;
create policy controlled_transitions_tenant_isolation on controlled_transitions
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists audit_events_tenant_isolation on audit_events;
create policy audit_events_tenant_isolation on audit_events
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists units_property_tenant_isolation on units;
create policy units_property_tenant_isolation on units
  for all
  using (property_os_property_in_current_org(property_id))
  with check (property_os_property_in_current_org(property_id));

drop policy if exists knowledge_articles_property_tenant_isolation on knowledge_articles;
create policy knowledge_articles_property_tenant_isolation on knowledge_articles
  for all
  using (property_os_property_in_current_org(property_id))
  with check (property_os_property_in_current_org(property_id));

drop policy if exists listing_drafts_property_tenant_isolation on listing_drafts;
create policy listing_drafts_property_tenant_isolation on listing_drafts
  for all
  using (property_os_property_in_current_org(property_id))
  with check (property_os_property_in_current_org(property_id));
