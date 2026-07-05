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
  "approvals",
  "agent_runs",
  "audit_events"
];

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10
});

async function countVisibleRows(orgId) {
  return sql.begin(async (tx) => {
    await tx`select set_config('property_os.organization_id', ${orgId}, true)`;
    const current = await tx`select property_os_current_organization_id() as current_organization_id`;
    const properties = await tx`select count(*)::int as count from properties`;
    const support = await tx`select count(*)::int as count from support_tickets`;

    return {
      currentOrganizationId: current[0]?.current_organization_id,
      properties: properties[0]?.count ?? 0,
      supportTickets: support[0]?.count ?? 0
    };
  });
}

try {
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

  const activeOrg = await countVisibleRows(organizationId);
  if (activeOrg.currentOrganizationId !== organizationId) {
    throw new Error(`Tenant context did not resolve to ${organizationId}.`);
  }

  if (activeOrg.properties < 1) {
    throw new Error(`No properties are visible for ${organizationId}. Seed the target org before running this smoke test.`);
  }

  const impossibleOrg = await countVisibleRows(impossibleOrganizationId);
  if (impossibleOrg.properties !== 0 || impossibleOrg.supportTickets !== 0) {
    throw new Error("RLS isolation failed: rows were visible for an unseeded organization context.");
  }

  console.log(`Postgres/RLS smoke passed for ${organizationId}.`);
} finally {
  await sql.end({ timeout: 5 });
}
