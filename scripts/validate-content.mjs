import { readFile } from "node:fs/promises";
import path from "node:path";

const source = await readFile(path.join(process.cwd(), "data", "properties.ts"), "utf8");
const productSource = await readFile(path.join(process.cwd(), "lib", "product.ts"), "utf8");
const runtimeContracts = await readFile(path.join(process.cwd(), "lib", "runtime-contracts.ts"), "utf8");
const implementationSource = await readFile(path.join(process.cwd(), "lib", "implementation.ts"), "utf8");
const runtimeStoreSource = await readFile(path.join(process.cwd(), "lib", "runtime-store.ts"), "utf8");
const authSource = await readFile(path.join(process.cwd(), "lib", "auth.ts"), "utf8");
const rlsSource = await readFile(path.join(process.cwd(), "db", "rls.sql"), "utf8");
const seedSource = await readFile(path.join(process.cwd(), "db", "seed-sample.sql"), "utf8");
const rlsSmokeSource = await readFile(path.join(process.cwd(), "scripts", "postgres-rls-smoke.mjs"), "utf8");
const authSmokeSource = await readFile(path.join(process.cwd(), "scripts", "auth-boundary-smoke.mjs"), "utf8");
await readFile(path.join(process.cwd(), "lib", "owner-notifications.ts"), "utf8");
await readFile(path.join(process.cwd(), "app", "admin", "sign-in", "page.tsx"), "utf8");
await readFile(path.join(process.cwd(), "app", "api", "auth", "owner", "sign-in", "route.ts"), "utf8");
await readFile(path.join(process.cwd(), "scripts", "generate-owner-passcode-hash.mjs"), "utf8");
await readFile(path.join(process.cwd(), "docs", "v0-implementation-brief.md"), "utf8");
await readFile(path.join(process.cwd(), "docs", "implementation-cockpit.md"), "utf8");
await readFile(path.join(process.cwd(), "docs", "runtime-adapter.md"), "utf8");
await readFile(path.join(process.cwd(), "docs", "owner-auth.md"), "utf8");
await readFile(path.join(process.cwd(), ".github", "ISSUE_TEMPLATE", "install-support.md"), "utf8");
await readFile(path.join(process.cwd(), ".github", "ISSUE_TEMPLATE", "integration-request.md"), "utf8");
await readFile(path.join(process.cwd(), ".github", "ISSUE_TEMPLATE", "safety-review.md"), "utf8");

const requiredSnippets = [
  "properties",
  "listingDrafts",
  "staySessions",
  "urban-haven-sample",
  "sample-stay",
  "ownerChecklist",
  "premiumSignals",
  "missingFacts",
  "publicationMode"
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`data/properties.ts is missing ${snippet}`);
  }
}

const requiredProductSnippets = [
  "setupSteps",
  "integrations",
  "sampleAgentRuns",
  "classifySupport",
  "urgent-owner-escalation",
  "owner-private-review"
];

for (const snippet of requiredProductSnippets) {
  if (!productSource.includes(snippet)) {
    throw new Error(`lib/product.ts is missing ${snippet}`);
  }
}

const requiredRuntimeSnippets = [
  "runtimeHealth",
  "blockedV1Actions",
  "createApprovalRecord",
  "createAgentRun",
  "createListingDryRun",
  "notificationMode",
  "capabilities",
  "OWNER_PORTAL_SECRET",
  "OWNER_PORTAL_PASSCODE_HASH"
];

const requiredImplementationSnippets = [
  "implementationLayers",
  "implementationReadiness",
  "partnerOffers",
  "blockedV1Actions",
  "runtimeMode"
];

const requiredRuntimeStoreSnippets = [
  "runtimeSnapshot",
  "persistInquiry",
  "persistSupport",
  "persistApproval",
  "persistAgentRun",
  "persistListingDryRun",
  "withOrganizationContext",
  "property_os.organization_id",
  "postgres"
];

const requiredAuthSnippets = [
  "requireOwnerAccess",
  "requireOwnerApiAccess",
  "OWNER_PORTAL_SECRET",
  "OWNER_PORTAL_PASSCODE_HASH",
  "PROPERTY_OS_DEMO_AUTH",
  "ownerSessionCookie"
];

const requiredRlsSnippets = [
  "property_os_current_organization_id",
  "enable row level security",
  "force row level security",
  "organizations_tenant_isolation",
  "properties_tenant_isolation",
  "support_tickets_tenant_isolation",
  "property_os_property_in_current_org"
];

const requiredSeedSnippets = [
  "sample-org",
  "urban-haven-sample",
  "sample-owner",
  "sample-property-urban-haven"
];

const requiredRlsSmokeSnippets = [
  "DATABASE_URL",
  "property_os_current_organization_id",
  "relrowsecurity",
  "relforcerowsecurity",
  "RLS isolation failed"
];

const requiredAuthSmokeSnippets = [
  "OWNER_PORTAL_SECRET",
  "OWNER_PORTAL_PASSCODE_HASH",
  "OWNER_PORTAL_API_TOKEN",
  "/api/runtime/snapshot",
  "property_os_owner_session"
];

for (const snippet of requiredRuntimeSnippets) {
  if (!runtimeContracts.includes(snippet)) {
    throw new Error(`lib/runtime-contracts.ts is missing ${snippet}`);
  }
}

for (const snippet of requiredImplementationSnippets) {
  if (!implementationSource.includes(snippet)) {
    throw new Error(`lib/implementation.ts is missing ${snippet}`);
  }
}

for (const snippet of requiredRuntimeStoreSnippets) {
  if (!runtimeStoreSource.includes(snippet)) {
    throw new Error(`lib/runtime-store.ts is missing ${snippet}`);
  }
}

for (const snippet of requiredAuthSnippets) {
  if (!authSource.includes(snippet)) {
    throw new Error(`lib/auth.ts is missing ${snippet}`);
  }
}

for (const snippet of requiredRlsSnippets) {
  if (!rlsSource.includes(snippet)) {
    throw new Error(`db/rls.sql is missing ${snippet}`);
  }
}

for (const snippet of requiredSeedSnippets) {
  if (!seedSource.includes(snippet)) {
    throw new Error(`db/seed-sample.sql is missing ${snippet}`);
  }
}

for (const snippet of requiredRlsSmokeSnippets) {
  if (!rlsSmokeSource.includes(snippet)) {
    throw new Error(`scripts/postgres-rls-smoke.mjs is missing ${snippet}`);
  }
}

for (const snippet of requiredAuthSmokeSnippets) {
  if (!authSmokeSource.includes(snippet)) {
    throw new Error(`scripts/auth-boundary-smoke.mjs is missing ${snippet}`);
  }
}

console.log("Portal content validation passed.");
