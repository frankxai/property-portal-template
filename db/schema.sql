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
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

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
