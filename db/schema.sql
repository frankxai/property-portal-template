-- Property Intelligence OS starter schema.
-- Target: managed Postgres on Supabase, Neon, or another Vercel-connected provider.
-- This schema stores runtime data. Public/template repos should contain only sample facts.

create table if not exists organizations (
  id text primary key,
  name text not null,
  plan text not null default 'pilot',
  country text not null default 'Germany',
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'manager', 'agency-admin', 'viewer')),
  identity_issuer text,
  identity_subject text,
  status text not null default 'active' check (status in ('active', 'revoked')),
  last_authenticated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((identity_issuer is null) = (identity_subject is null)),
  unique (organization_id, email)
);

create unique index if not exists organization_members_identity_idx
  on organization_members (organization_id, identity_issuer, identity_subject)
  where identity_issuer is not null and identity_subject is not null;

-- Better Auth owns these protocol/session tables. Property OS authorization remains in organization_members.
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

insert into property_os_schema_versions (component, version)
values ('better-auth', '1.6.23-property-os.1')
on conflict (component) do update
set version = excluded.version, applied_at = now();

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


create table if not exists properties (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  status text not null check (status in ('draft', 'owner-review', 'approved', 'published', 'archived')),
  public_area text not null,
  city text not null,
  country text not null default 'Germany',
  exact_address_private text,
  address_publication_policy text not null default 'hide-until-owner-approval',
  approved_public_facts jsonb not null default '{}'::jsonb,
  private_owner_notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists units (
  id text primary key,
  property_id text not null references properties(id) on delete cascade,
  name text not null,
  status text not null check (status in ('draft', 'available', 'reserved', 'occupied', 'maintenance', 'unknown', 'archived')),
  bedrooms integer not null default 0,
  max_occupancy integer not null default 1,
  public_pricing jsonb not null default '{}'::jsonb,
  private_pricing jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_articles (
  id text primary key,
  property_id text not null references properties(id) on delete cascade,
  audience text not null check (audience in ('public', 'renter', 'owner', 'vendor')),
  title text not null,
  body text not null,
  status text not null check (status in ('draft', 'owner-review', 'approved', 'published', 'archived')),
  contains_private_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists listing_drafts (
  id text primary key,
  property_id text not null references properties(id) on delete cascade,
  channel text not null,
  status text not null check (status in ('draft', 'owner-review', 'approved', 'published', 'archived')),
  headline text not null,
  body text not null,
  missing_facts jsonb not null default '[]'::jsonb,
  owner_checklist jsonb not null default '[]'::jsonb,
  publication_mode text not null default 'manual-copy',
  external_listing_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inquiries (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  property_id text not null references properties(id) on delete cascade,
  source text not null default 'own-website',
  status text not null check (status in ('new', 'owner-review', 'replied', 'closed', 'archived')),
  requester_name text,
  requester_email text,
  rental_window text,
  message_private text not null,
  sanitized_summary text not null,
  owner_approval_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists support_tickets (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  property_id text not null references properties(id) on delete cascade,
  category text not null,
  urgency text not null,
  route text not null,
  status text not null check (status in ('new', 'triage', 'owner-review', 'vendor-review', 'resolved', 'archived')),
  message_private text not null,
  sanitized_summary text not null,
  owner_action text not null,
  owner_approval_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create index if not exists notification_deliveries_due_idx
  on notification_deliveries (organization_id, status, next_attempt_at, created_at);
create index if not exists notification_events_delivery_idx
  on notification_events (organization_id, notification_id, occurred_at desc);

create table if not exists weekly_owner_reviews (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  week_of date not null,
  status text not null check (status in ('in-progress', 'completed')),
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  repeated_questions_total integer check (repeated_questions_total is null or repeated_questions_total >= 0),
  repeated_questions_covered integer check (repeated_questions_covered is null or repeated_questions_covered >= 0),
  known_vacancy_date date,
  listing_ready_date date,
  keep_note text not null default '',
  change_note text not null default '',
  stop_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, week_of),
  unique (id, organization_id),
  check (
    repeated_questions_total is null
    or repeated_questions_covered is null
    or repeated_questions_covered <= repeated_questions_total
  ),
  check ((known_vacancy_date is null) = (listing_ready_date is null))
);

create table if not exists weekly_metric_observations (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  weekly_review_id text not null,
  metric_id text not null check (metric_id in ('owner-review-time', 'self-service-coverage', 'vacancy-readiness', 'urgent-acknowledgement', 'unauthorized-actions')),
  label text not null,
  value_numeric numeric,
  unit text not null check (unit in ('minutes', 'percent', 'days', 'count')),
  target text not null,
  status text not null check (status in ('met', 'not-met', 'unmeasured')),
  source text not null check (source in ('server-derived', 'owner-entered', 'system-policy')),
  evidence_ref text not null,
  observed_at timestamptz not null,
  constraint weekly_metric_observations_tenant_review_fk
    foreign key (weekly_review_id, organization_id)
    references weekly_owner_reviews(id, organization_id) on delete cascade,
  unique (organization_id, weekly_review_id, metric_id)
);

create index if not exists weekly_owner_reviews_org_week_idx
  on weekly_owner_reviews (organization_id, week_of desc);
create index if not exists weekly_metric_observations_review_idx
  on weekly_metric_observations (organization_id, weekly_review_id, observed_at);

create table if not exists approvals (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  subject_type text not null,
  subject_id text not null,
  status text not null check (status in ('requested', 'approved', 'rejected', 'needs-change')),
  requested_by text not null default 'system',
  decided_by text,
  decision_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists agent_runs (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  role text not null,
  trigger text not null,
  output text not null,
  approval_risk text not null,
  owner_action text not null,
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists agent_missions (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  role text not null,
  property_slug text,
  objective text not null,
  success_metric text not null,
  status text not null check (status in ('planned', 'grounding', 'drafting', 'owner-review', 'verified', 'stopped')),
  authority text not null check (authority = 'draft-only'),
  stages jsonb not null default '[]'::jsonb,
  owner_action text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists resource_versions (
  organization_id text not null references organizations(id) on delete cascade,
  resource_id text not null,
  version_hash text not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, resource_id)
);

create table if not exists transition_proposals (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  operation text not null,
  resource_id text not null,
  base_version_hash text not null,
  payload_hash text not null,
  summary text not null,
  status text not null check (status in ('pending', 'approved', 'rejected', 'applied', 'superseded')),
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists approval_receipts (
  id text primary key,
  proposal_id text not null references transition_proposals(id) on delete cascade,
  organization_id text not null references organizations(id) on delete cascade,
  actor_id text not null,
  actor_role text not null,
  operation text not null,
  resource_id text not null,
  base_version_hash text not null,
  payload_hash text not null,
  policy_version text not null,
  scopes jsonb not null default '[]'::jsonb,
  status text not null check (status in ('active', 'consumed', 'revoked', 'expired')),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create table if not exists controlled_transitions (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  proposal_id text not null references transition_proposals(id),
  approval_receipt_id text not null references approval_receipts(id),
  idempotency_key text not null,
  operation text not null,
  resource_id text not null,
  previous_version_hash text not null,
  new_version_hash text not null,
  undo_metadata jsonb not null default '{}'::jsonb,
  applied_by text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table if not exists audit_events (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  actor text not null,
  event_type text not null,
  subject_type text not null,
  subject_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
