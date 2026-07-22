import { readFile } from "node:fs/promises";
import path from "node:path";

const source = await readFile(path.join(process.cwd(), "data", "properties.ts"), "utf8");
const productSource = await readFile(path.join(process.cwd(), "lib", "product.ts"), "utf8");
const runtimeContracts = await readFile(path.join(process.cwd(), "lib", "runtime-contracts.ts"), "utf8");
const implementationSource = await readFile(path.join(process.cwd(), "lib", "implementation.ts"), "utf8");
const installProofSource = await readFile(path.join(process.cwd(), "lib", "install-proof.ts"), "utf8");
const runtimeStoreSource = await readFile(path.join(process.cwd(), "lib", "runtime-store.ts"), "utf8");
const controlPlaneSource = await readFile(path.join(process.cwd(), "lib", "agent-control-plane.ts"), "utf8");
const notificationPolicySource = await readFile(path.join(process.cwd(), "lib", "notification-policy.ts"), "utf8");
const notificationWorkerSource = await readFile(path.join(process.cwd(), "lib", "notification-worker.ts"), "utf8");
const notificationStoreSource = await readFile(path.join(process.cwd(), "lib", "runtime-store.ts"), "utf8");
const weeklyReviewSource = await readFile(path.join(process.cwd(), "lib", "weekly-review.ts"), "utf8");
const authSource = await readFile(path.join(process.cwd(), "lib", "auth.ts"), "utf8");
const schemaSource = await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");
const rlsSource = await readFile(path.join(process.cwd(), "db", "rls.sql"), "utf8");
const seedSource = await readFile(path.join(process.cwd(), "db", "seed-sample.sql"), "utf8");
const rlsSmokeSource = await readFile(path.join(process.cwd(), "scripts", "postgres-rls-smoke.mjs"), "utf8");
const authSmokeSource = await readFile(path.join(process.cwd(), "scripts", "auth-boundary-smoke.mjs"), "utf8");
const installProofCliSource = await readFile(path.join(process.cwd(), "scripts", "install-proof-packet.mjs"), "utf8");
const installProofRouteSource = await readFile(path.join(process.cwd(), "app", "api", "install", "proof-packet", "route.ts"), "utf8");
const selfServiceInstallDocs = await readFile(path.join(process.cwd(), "docs", "self-service-install.md"), "utf8");
await readFile(path.join(process.cwd(), "lib", "owner-notifications.ts"), "utf8");
await readFile(path.join(process.cwd(), "app", "admin", "sign-in", "page.tsx"), "utf8");
const controlCenterSource = await readFile(path.join(process.cwd(), "app", "admin", "control-center", "page.tsx"), "utf8");
const workbenchPageSource = await readFile(path.join(process.cwd(), "app", "admin", "agent-workbench", "page.tsx"), "utf8");
const workbenchComponentSource = await readFile(path.join(process.cwd(), "components", "AgentWorkbench.tsx"), "utf8");
const missionRouteSource = await readFile(path.join(process.cwd(), "app", "api", "agent-missions", "route.ts"), "utf8");
const mcpClientSource = await readFile(path.join(process.cwd(), "lib", "mcp-control-plane.ts"), "utf8");
const evidenceRouteSource = await readFile(path.join(process.cwd(), "app", "api", "approved-evidence", "route.ts"), "utf8");
const draftRouteSource = await readFile(path.join(process.cwd(), "app", "api", "agent-drafts", "route.ts"), "utf8");
const reviewRouteSource = await readFile(path.join(process.cwd(), "app", "api", "agent-run-reviews", "route.ts"), "utf8");
await readFile(path.join(process.cwd(), "app", "api", "auth", "owner", "sign-in", "route.ts"), "utf8");
await readFile(path.join(process.cwd(), "scripts", "generate-owner-passcode-hash.mjs"), "utf8");
await readFile(path.join(process.cwd(), "docs", "v0-implementation-brief.md"), "utf8");
await readFile(path.join(process.cwd(), "docs", "implementation-cockpit.md"), "utf8");
await readFile(path.join(process.cwd(), "docs", "agent-control-center-spec.md"), "utf8");
await readFile(path.join(process.cwd(), "docs", "agent-workbench-spec.md"), "utf8");
await readFile(path.join(process.cwd(), "design-loop-evidence.json"), "utf8");
await readFile(path.join(process.cwd(), "docs", "runtime-adapter.md"), "utf8");
await readFile(path.join(process.cwd(), "docs", "owner-auth.md"), "utf8");
const notificationDocsSource = await readFile(path.join(process.cwd(), "docs", "notification-lifecycle.md"), "utf8");
await readFile(path.join(process.cwd(), "db", "002-notification-lifecycle.sql"), "utf8");
await readFile(path.join(process.cwd(), "app", "admin", "notifications", "page.tsx"), "utf8");
await readFile(path.join(process.cwd(), "components", "NotificationCenter.tsx"), "utf8");
await readFile(path.join(process.cwd(), "app", "api", "notifications", "route.ts"), "utf8");
await readFile(path.join(process.cwd(), "app", "api", "notifications", "process", "route.ts"), "utf8");
await readFile(path.join(process.cwd(), "app", "api", "notifications", "[id]", "acknowledge", "route.ts"), "utf8");
await readFile(path.join(process.cwd(), "scripts", "notification-lifecycle-smoke.mjs"), "utf8");
await readFile(path.join(process.cwd(), "scripts", "notification-visual-qa.mjs"), "utf8");
const weeklyReviewComponentSource = await readFile(path.join(process.cwd(), "components", "WeeklyReviewConsole.tsx"), "utf8");
const weeklyReviewRouteSource = await readFile(path.join(process.cwd(), "app", "api", "weekly-reviews", "route.ts"), "utf8");
const weeklyReviewCompleteRouteSource = await readFile(path.join(process.cwd(), "app", "api", "weekly-reviews", "[id]", "complete", "route.ts"), "utf8");
const weeklyReviewSmokeSource = await readFile(path.join(process.cwd(), "scripts", "weekly-review-smoke.mjs"), "utf8");
await readFile(path.join(process.cwd(), "scripts", "weekly-review-visual-qa.mjs"), "utf8");
await readFile(path.join(process.cwd(), "db", "003-weekly-owner-review.sql"), "utf8");
await readFile(path.join(process.cwd(), "docs", "weekly-owner-review.md"), "utf8");
await readFile(path.join(process.cwd(), "artifacts", "visual-qa", "notifications-desktop.png"));
await readFile(path.join(process.cwd(), "artifacts", "visual-qa", "notifications-mobile.png"));
await readFile(path.join(process.cwd(), "artifacts", "visual-qa", "weekly-review-desktop.png"));
await readFile(path.join(process.cwd(), "artifacts", "visual-qa", "weekly-review-mobile.png"));
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

const requiredInstallProofSnippets = [
  "createInstallProofPacket",
  "installPhases",
  "owner-auth",
  "runtime-database",
  "npm run install:proof",
  "does not print secret values",
  "ownerApprovalRequiredFor",
  "blockedV1Actions",
  "separate tenant-isolated logical databases",
  "npm run notification:smoke"
];

const requiredRuntimeStoreSnippets = [
  "runtimeSnapshot",
  "persistInquiry",
  "persistSupport",
  "persistApproval",
  "persistAgentRun",
  "persistAgentMission",
  "persistNotification",
  "claimDueNotificationDeliveries",
  "completeNotificationDelivery",
  "acknowledgeNotificationDelivery",
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
  "ownerSessionCookie",
  "requireNotificationWorkerAccess",
  "OWNER_NOTIFICATION_WORKER_TOKEN"
];

const requiredControlPlaneSnippets = [
  "Property Steward",
  "Implementation Lead",
  "observe",
  "verify",
  "Under 30 minutes",
  "server receipt",
  "blockedActions"
];

const requiredSchemaSnippets = [
  "agent_missions",
  "transition_proposals",
  "approval_receipts",
  "controlled_transitions",
  "notification_deliveries",
  "notification_events",
  "weekly_owner_reviews",
  "weekly_metric_observations",
  "weekly_metric_observations_tenant_review_fk",
  "unique (organization_id, idempotency_key)"
];

const requiredControlCenterSnippets = [
  "Owner control center",
  "Unsafe actions enabled",
  "AgentMissionForm",
  "authorityContract",
  "successScorecard"
];

const requiredWorkbenchPageSnippets = [
  "requireOwnerAccess",
  "runtimeHealth",
  "AgentWorkbench",
  "From approved fact to reviewable work.",
  "External actions"
];

const requiredWorkbenchComponentSnippets = [
  "/api/agent-missions",
  "/api/approved-evidence",
  "/api/agent-drafts",
  "/api/agent-run-reviews",
  "contentApplied",
  "externalActionsPerformed",
  "Nothing was applied or sent."
];

const requiredMissionRouteSnippets = [
  "requireOwnerApiAccess",
  "persistAgentMission",
  "ownerApprovalRequired",
  "persistence.status === \"failed\"",
  "owner-mission-review"
];

const requiredMcpClientSnippets = [
  "record_approved_evidence",
  "run_agent_draft",
  "record_agent_run_review",
  "evidenceSnapshot",
  "contentApplied: z.literal(false)",
  "AbortSignal.timeout"
];

const requiredGovernedRouteSnippets = [
  "requireOwnerApiAccess",
  "requireConfiguredControlPlane",
  "controlPlaneFailure",
  "mcp-control-plane"
];

const requiredRlsSnippets = [
  "property_os_current_organization_id",
  "enable row level security",
  "force row level security",
  "organizations_tenant_isolation",
  "properties_tenant_isolation",
  "support_tickets_tenant_isolation",
  "notification_deliveries_tenant_isolation",
  "notification_events_tenant_isolation",
  "weekly_owner_reviews_tenant_isolation",
  "weekly_metric_observations_tenant_isolation",
  "agent_missions_tenant_isolation",
  "transition_proposals_tenant_isolation",
  "approval_receipts_tenant_isolation",
  "controlled_transitions_tenant_isolation",
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
  "notification_deliveries",
  "notification_events",
  "weekly_owner_reviews",
  "weekly_metric_observations",
  "RLS isolation failed"
];

const requiredWeeklyReviewSnippets = [
  "owner-review-time",
  "self-service-coverage",
  "vacancy-readiness",
  "urgent-acknowledgement",
  "unauthorized-actions",
  "unmeasured",
  "system-policy"
];

const requiredWeeklyReviewComponentSnippets = [
  "/api/weekly-reviews",
  "Keep",
  "Change",
  "Stop",
  "Missing operational evidence remains unmeasured",
  "governed action surface"
];

const requiredWeeklyReviewRouteSnippets = [
  "requireOwnerApiAccess",
  "externalActionsPerformed: []",
  "governedActionBoundary"
];

const requiredWeeklyReviewCompleteRouteSnippets = [
  "validateWeeklyReviewCompletion",
  "contentApplied: false",
  "externalActionsPerformed: []",
  "metricBoundary"
];

const requiredWeeklyReviewSmokeSnippets = [
  "idempotent start/completion",
  "urgent-acknowledgement",
  "unmeasured",
  "externalActionsPerformed",
  "changed, false"
];

const requiredNotificationPolicySnippets = [
  "property-os.ownerNotification.v1",
  "notificationPayloadHash",
  "acknowledgementRequired",
  "externalActionsPerformed: []",
  "OWNER_NOTIFICATION_ACK_TIMEOUT_MS"
];

const requiredNotificationWorkerSnippets = [
  "x-property-os-signature",
  "x-property-os-idempotency-key",
  "redirect: \"error\"",
  "claimDueNotificationDeliveries",
  "completeNotificationDelivery",
  "externalActionsPerformed: []"
];

const requiredAuthSmokeSnippets = [
  "OWNER_PORTAL_SECRET",
  "OWNER_PORTAL_PASSCODE_HASH",
  "OWNER_PORTAL_API_TOKEN",
  "/api/runtime/snapshot",
  "property_os_owner_session"
];

const requiredInstallProofCliSnippets = [
  "OWNER_PORTAL_SECRET",
  "OWNER_PORTAL_PASSCODE_HASH",
  "app/api/install/proof-packet/route.ts",
  "does not print secret values",
  "npm run db:rls:smoke",
  "npm run notification:smoke",
  "notificationBoundary",
  "separate tenant-isolated logical databases"
];

const requiredInstallProofRouteSnippets = [
  "requireOwnerApiAccess",
  "createInstallProofPacket",
  "NextResponse.json"
];

const requiredSelfServiceInstallSnippets = [
  "/api/install/proof-packet",
  "npm run install:proof",
  "npm run db:rls:smoke",
  "45-Minute Community Fork Path",
  "does not print secret values",
  "npm run install:plan",
  "same logical database",
  "OIDC",
  "npm run notification:smoke"
];

for (const snippet of [
  "transactional outbox",
  "FOR UPDATE SKIP LOCKED",
  "HMAC-SHA256",
  "npm run notification:smoke",
  "local mock pass is not delivery evidence"
]) {
  if (!notificationDocsSource.includes(snippet)) {
    throw new Error(`docs/notification-lifecycle.md is missing ${snippet}`);
  }
}

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

for (const snippet of requiredInstallProofSnippets) {
  if (!installProofSource.includes(snippet)) {
    throw new Error(`lib/install-proof.ts is missing ${snippet}`);
  }
}

for (const snippet of requiredRuntimeStoreSnippets) {
  if (!runtimeStoreSource.includes(snippet)) {
    throw new Error(`lib/runtime-store.ts is missing ${snippet}`);
  }
}

for (const snippet of requiredNotificationPolicySnippets) {
  if (!notificationPolicySource.includes(snippet)) {
    throw new Error(`lib/notification-policy.ts is missing ${snippet}`);
  }
}

for (const snippet of requiredNotificationWorkerSnippets) {
  if (!notificationWorkerSource.includes(snippet)) {
    throw new Error(`lib/notification-worker.ts is missing ${snippet}`);
  }
}

for (const snippet of ["notification_deliveries", "notification_events", "notificationSummary"]) {
  if (!notificationStoreSource.includes(snippet)) {
    throw new Error(`lib/runtime-store.ts is missing ${snippet}`);
  }
}

for (const snippet of requiredWeeklyReviewSnippets) {
  if (!weeklyReviewSource.includes(snippet)) {
    throw new Error(`lib/weekly-review.ts is missing ${snippet}`);
  }
}

for (const snippet of requiredWeeklyReviewComponentSnippets) {
  if (!weeklyReviewComponentSource.includes(snippet)) {
    throw new Error(`components/WeeklyReviewConsole.tsx is missing ${snippet}`);
  }
}

for (const snippet of requiredWeeklyReviewRouteSnippets) {
  if (!weeklyReviewRouteSource.includes(snippet)) {
    throw new Error(`app/api/weekly-reviews/route.ts is missing ${snippet}`);
  }
}

for (const snippet of requiredWeeklyReviewCompleteRouteSnippets) {
  if (!weeklyReviewCompleteRouteSource.includes(snippet)) {
    throw new Error(`app/api/weekly-reviews/[id]/complete/route.ts is missing ${snippet}`);
  }
}

for (const snippet of requiredWeeklyReviewSmokeSnippets) {
  if (!weeklyReviewSmokeSource.includes(snippet)) {
    throw new Error(`scripts/weekly-review-smoke.mjs is missing ${snippet}`);
  }
}

for (const snippet of requiredControlPlaneSnippets) {
  if (!controlPlaneSource.includes(snippet)) {
    throw new Error(`lib/agent-control-plane.ts is missing ${snippet}`);
  }
}

for (const snippet of requiredSchemaSnippets) {
  if (!schemaSource.includes(snippet)) {
    throw new Error(`db/schema.sql is missing ${snippet}`);
  }
}

for (const snippet of requiredControlCenterSnippets) {
  if (!controlCenterSource.includes(snippet)) {
    throw new Error(`app/admin/control-center/page.tsx is missing ${snippet}`);
  }
}

for (const snippet of requiredWorkbenchPageSnippets) {
  if (!workbenchPageSource.includes(snippet)) {
    throw new Error(`app/admin/agent-workbench/page.tsx is missing ${snippet}`);
  }
}

for (const snippet of requiredWorkbenchComponentSnippets) {
  if (!workbenchComponentSource.includes(snippet)) {
    throw new Error(`components/AgentWorkbench.tsx is missing ${snippet}`);
  }
}

for (const snippet of requiredMissionRouteSnippets) {
  if (!missionRouteSource.includes(snippet)) {
    throw new Error(`app/api/agent-missions/route.ts is missing ${snippet}`);
  }
}

for (const snippet of requiredMcpClientSnippets) {
  if (!mcpClientSource.includes(snippet)) {
    throw new Error(`lib/mcp-control-plane.ts is missing ${snippet}`);
  }
}

for (const [name, routeSource] of [
  ["approved-evidence", evidenceRouteSource],
  ["agent-drafts", draftRouteSource],
  ["agent-run-reviews", reviewRouteSource]
]) {
  for (const snippet of requiredGovernedRouteSnippets) {
    if (!routeSource.includes(snippet)) {
      throw new Error(`app/api/${name}/route.ts is missing ${snippet}`);
    }
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

for (const snippet of requiredInstallProofCliSnippets) {
  if (!installProofCliSource.includes(snippet)) {
    throw new Error(`scripts/install-proof-packet.mjs is missing ${snippet}`);
  }
}

for (const snippet of requiredInstallProofRouteSnippets) {
  if (!installProofRouteSource.includes(snippet)) {
    throw new Error(`app/api/install/proof-packet/route.ts is missing ${snippet}`);
  }
}

for (const snippet of requiredSelfServiceInstallSnippets) {
  if (!selfServiceInstallDocs.includes(snippet)) {
    throw new Error(`docs/self-service-install.md is missing ${snippet}`);
  }
}

console.log("Portal content validation passed.");
