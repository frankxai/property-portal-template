-- Server-timestamped owner reviews and immutable metric observations.
-- Apply to existing portal databases after db/002-notification-lifecycle.sql.
-- Fresh databases receive the same tables through db/schema.sql and db/rls.sql.

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

alter table weekly_owner_reviews enable row level security;
alter table weekly_owner_reviews force row level security;
alter table weekly_metric_observations enable row level security;
alter table weekly_metric_observations force row level security;

drop policy if exists weekly_owner_reviews_tenant_isolation on weekly_owner_reviews;
create policy weekly_owner_reviews_tenant_isolation on weekly_owner_reviews
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

drop policy if exists weekly_metric_observations_tenant_isolation on weekly_metric_observations;
create policy weekly_metric_observations_tenant_isolation on weekly_metric_observations
  for all
  using (organization_id = property_os_current_organization_id())
  with check (organization_id = property_os_current_organization_id());

create index if not exists weekly_owner_reviews_org_week_idx
  on weekly_owner_reviews (organization_id, week_of desc);
create index if not exists weekly_metric_observations_review_idx
  on weekly_metric_observations (organization_id, weekly_review_id, observed_at);
