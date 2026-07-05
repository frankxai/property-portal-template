import { readFile } from "node:fs/promises";
import path from "node:path";

const source = await readFile(path.join(process.cwd(), "data", "properties.ts"), "utf8");
const productSource = await readFile(path.join(process.cwd(), "lib", "product.ts"), "utf8");
const runtimeContracts = await readFile(path.join(process.cwd(), "lib", "runtime-contracts.ts"), "utf8");
const implementationSource = await readFile(path.join(process.cwd(), "lib", "implementation.ts"), "utf8");
const runtimeStoreSource = await readFile(path.join(process.cwd(), "lib", "runtime-store.ts"), "utf8");
const rlsSource = await readFile(path.join(process.cwd(), "db", "rls.sql"), "utf8");
const seedSource = await readFile(path.join(process.cwd(), "db", "seed-sample.sql"), "utf8");
await readFile(path.join(process.cwd(), "lib", "owner-notifications.ts"), "utf8");
await readFile(path.join(process.cwd(), "docs", "v0-implementation-brief.md"), "utf8");
await readFile(path.join(process.cwd(), "docs", "implementation-cockpit.md"), "utf8");
await readFile(path.join(process.cwd(), "docs", "runtime-adapter.md"), "utf8");
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
  "capabilities"
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

console.log("Portal content validation passed.");
