import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required for the Postgres/RLS smoke test.");
  process.exit(1);
}

const organizationId = process.env.PROPERTY_OS_ORG_ID || "sample-org";
const impossibleOrganizationId = `rls-smoke-${Date.now()}`;
const requiredTables = [
  "organizations",
  "organization_members",
  "properties",
  "units",
  "knowledge_articles",
  "listing_drafts",
  "inquiries",
  "support_tickets",
  "notification_deliveries",
  "notification_events",
  "weekly_owner_reviews",
  "weekly_metric_observations",
  "approvals",
  "agent_runs",
  "agent_missions",
  "resource_versions",
  "transition_proposals",
  "approval_receipts",
  "controlled_transitions",
  "audit_events"
];
const requiredAuthTables = [
  "auth_users",
  "auth_sessions",
  "auth_accounts",
  "auth_verifications",
  "auth_rate_limits",
  "property_os_schema_versions"
];

const sql = postgres(databaseUrl, {
  max: 4,
  idle_timeout: 20,
  connect_timeout: 10
});

async function countVisibleRows(orgId) {
  return sql.begin(async (tx) => {
    await tx`select set_config('property_os.organization_id', ${orgId}, true)`;
    const current = await tx`select property_os_current_organization_id() as current_organization_id`;
    const properties = await tx`select count(*)::int as count from properties`;
    const support = await tx`select count(*)::int as count from support_tickets`;
    const notifications = await tx`select count(*)::int as count from notification_deliveries`;
    const notificationEvents = await tx`select count(*)::int as count from notification_events`;
    const weeklyReviews = await tx`select count(*)::int as count from weekly_owner_reviews`;
    const weeklyObservations = await tx`select count(*)::int as count from weekly_metric_observations`;

    return {
      currentOrganizationId: current[0]?.current_organization_id,
      properties: properties[0]?.count ?? 0,
      supportTickets: support[0]?.count ?? 0,
      notifications: notifications[0]?.count ?? 0,
      notificationEvents: notificationEvents[0]?.count ?? 0,
      weeklyReviews: weeklyReviews[0]?.count ?? 0,
      weeklyObservations: weeklyObservations[0]?.count ?? 0
    };
  });
}

try {
  const runtimeRole = await sql`
    select r.rolname, r.rolsuper, r.rolbypassrls
    from pg_roles r
    where r.rolname = current_user
  `;
  if (!runtimeRole[0] || runtimeRole[0].rolsuper || runtimeRole[0].rolbypassrls) {
    throw new Error("DATABASE_URL must use a dedicated NOSUPERUSER NOBYPASSRLS runtime role.");
  }

  const policyRows = await sql`
    select c.relname, c.relrowsecurity, c.relforcerowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ${sql(requiredTables)}
    order by c.relname
  `;

  const missingTables = requiredTables.filter((table) => !policyRows.some((row) => row.relname === table));
  if (missingTables.length) {
    throw new Error(`Missing runtime tables: ${missingTables.join(", ")}`);
  }

  const weakTables = policyRows.filter((row) => !row.relrowsecurity || !row.relforcerowsecurity);
  if (weakTables.length) {
    throw new Error(`RLS is not enabled and forced for: ${weakTables.map((row) => row.relname).join(", ")}`);
  }

  const ownedRuntimeTables = await sql`
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_roles r on r.oid = c.relowner
    where n.nspname = 'public'
      and c.relname in ${sql(requiredTables)}
      and r.rolname = current_user
  `;
  if (ownedRuntimeTables.length) {
    throw new Error(`Runtime role must not own RLS tables: ${ownedRuntimeTables.map((row) => row.relname).join(", ")}`);
  }

  const authTableRows = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_name in ${sql(requiredAuthTables)}
  `;
  const missingAuthTables = requiredAuthTables.filter((table) => !authTableRows.some((row) => row.table_name === table));
  if (missingAuthTables.length) throw new Error(`Missing pinned identity tables: ${missingAuthTables.join(", ")}`);

  const identityColumns = await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_members'
      and column_name in ('identity_issuer', 'identity_subject', 'status', 'last_authenticated_at')
  `;
  if (identityColumns.length !== 4) throw new Error("organization_members is missing tenant OIDC identity columns.");

  const schemaVersion = await sql`
    select version from property_os_schema_versions where component = 'better-auth'
  `;
  if (schemaVersion[0]?.version !== "1.6.23-property-os.1") {
    throw new Error("Better Auth schema version does not match 1.6.23-property-os.1.");
  }

  const [activeOrg, impossibleOrg, concurrentActiveOrg, concurrentImpossibleOrg] = await Promise.all([
    countVisibleRows(organizationId),
    countVisibleRows(impossibleOrganizationId),
    countVisibleRows(organizationId),
    countVisibleRows(`${impossibleOrganizationId}-concurrent`)
  ]);
  if (activeOrg.currentOrganizationId !== organizationId) {
    throw new Error(`Tenant context did not resolve to ${organizationId}.`);
  }

  if (activeOrg.properties < 1) {
    throw new Error(`No properties are visible for ${organizationId}. Seed the target org before running this smoke test.`);
  }

  if (
    impossibleOrg.properties !== 0 ||
    impossibleOrg.supportTickets !== 0 ||
    impossibleOrg.notifications !== 0 ||
    impossibleOrg.notificationEvents !== 0 ||
    impossibleOrg.weeklyReviews !== 0 ||
    impossibleOrg.weeklyObservations !== 0
  ) {
    throw new Error("RLS isolation failed: rows were visible for an unseeded organization context.");
  }

  if (concurrentActiveOrg.properties !== activeOrg.properties || concurrentImpossibleOrg.properties !== 0) {
    throw new Error("RLS isolation failed under concurrent pooled tenant contexts.");
  }

  console.log(`Postgres/RLS smoke passed for ${organizationId}.`);
} finally {
  await sql.end({ timeout: 5 });
}
