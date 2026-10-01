-- Durable owner-notification outbox and append-only lifecycle evidence.
-- Apply to existing portal databases after db/schema.sql and before rerunning db/rls.sql.

create table if not exists notification_deliveries (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  source_id text not null,
  kind text not null check (kind in ('inquiry', 'support', 'approval', 'agent-mission', 'agent-run', 'listing-dry-run')),
  urgency text not null check (urgency in ('standard', 'urgent', 'weekly')),
  route text not null,
  sanitized_summary text not null,
  owner_action text not null,
  payload_hash text not null check (length(payload_hash) = 64),
  status text not null check (status in ('queued', 'processing', 'sent', 'failed', 'fallback-required', 'fallback-sent', 'fallback-failed', 'acknowledged')),
  primary_target text not null check (primary_target in ('owner-webhook', 'none')),
  fallback_target text not null check (fallback_target in ('owner-fallback-webhook', 'none')),
  primary_attempt_count integer not null default 0 check (primary_attempt_count >= 0),
  fallback_attempt_count integer not null default 0 check (fallback_attempt_count >= 0),
  processing_action text check (processing_action in ('send-primary', 'send-fallback')),
  next_attempt_at timestamptz,
  claim_until timestamptz,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  fallback_delivered_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notification_events (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  notification_id text not null references notification_deliveries(id) on delete cascade,
  event_type text not null check (event_type in ('queued', 'claimed', 'delivery-succeeded', 'delivery-failed', 'fallback-required', 'fallback-succeeded', 'fallback-failed', 'acknowledged')),
  action text check (action in ('send-primary', 'send-fallback')),
  attempt_number integer check (attempt_number is null or attempt_number >= 0),
  provider text not null check (provider in ('none', 'webhook', 'fallback-webhook', 'owner-portal')),
  payload_hash text not null check (length(payload_hash) = 64),
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table notification_deliveries enable row level security;
alter table notification_deliveries force row level security;
alter table notification_events enable row level security;
alter table notification_events force row level security;

drop policy if exists notification_deliveries_tenant_isolation on notification_deliveries;
create policy notification_deliveries_tenant_isolation on notification_deliveries
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists notification_events_tenant_isolation on notification_events;
create policy notification_events_tenant_isolation on notification_events
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

create index if not exists notification_deliveries_due_idx
  on notification_deliveries (organization_id, status, next_attempt_at, created_at);
create index if not exists notification_events_delivery_idx
  on notification_events (organization_id, notification_id, occurred_at desc);
