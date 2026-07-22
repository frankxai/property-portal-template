import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { oidcAuthEnv, ownerAuthStatus, staticPrivatePilotAuthEnv } from "../lib/auth-configuration.ts";
import { controlPlaneConfiguration } from "../lib/mcp-configuration.ts";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const ownerAuth = ownerAuthStatus();
const controlPlane = controlPlaneConfiguration();

const requiredEnv = [
  "DATABASE_URL",
  "APP_BASE_URL",
  "OWNER_NOTIFICATION_WEBHOOK_URL",
  "OWNER_NOTIFICATION_WEBHOOK_SIGNING_SECRET",
  "OWNER_NOTIFICATION_FALLBACK_WEBHOOK_URL",
  "OWNER_NOTIFICATION_FALLBACK_SIGNING_SECRET",
  "OWNER_NOTIFICATION_WORKER_TOKEN",
  ...ownerAuth.requiredEnv
];

const optionalEnv = [
  "PROPERTY_OS_AUTH_MODE",
  "PROPERTY_OS_DEMO_AUTH",
  "PROPERTY_OS_DEMO_RUNTIME",
  ...staticPrivatePilotAuthEnv,
  ...oidcAuthEnv,
  "PROPERTY_OS_OIDC_PROVIDER_ID",
  "PROPERTY_OS_OIDC_ORGANIZATION_CLAIM",
  "PROPERTY_OS_OIDC_ROLE_CLAIM",
  "PROPERTY_OS_EXPECTED_OIDC_SUBJECTS",
  "MCP_SERVER_URL",
  "MCP_SERVER_AUTH_MODE",
  "MCP_SERVER_ACCESS_TOKEN",
  "MCP_OIDC_TOKEN_URL",
  "MCP_OIDC_CLIENT_ID",
  "MCP_OIDC_CLIENT_SECRET",
  "MCP_OIDC_AUDIENCE",
  "MCP_OIDC_SCOPE",
  "MCP_SERVER_ORIGIN",
  "MCP_REQUEST_TIMEOUT_MS",
  "OWNER_NOTIFICATION_MAX_ATTEMPTS",
  "OWNER_NOTIFICATION_RETRY_BASE_MS",
  "OWNER_NOTIFICATION_ACK_TIMEOUT_MS",
  "OWNER_NOTIFICATION_CLAIM_LEASE_MS",
  "OWNER_NOTIFICATION_REQUEST_TIMEOUT_MS",
  "OWNER_NOTIFICATION_BATCH_SIZE"
];

const requiredFiles = [
  "README.md",
  "TEMPLATE_READINESS.md",
  "data/properties.ts",
  "lib/install-proof.ts",
  "lib/auth.ts",
  "lib/auth-configuration.ts",
  "lib/identity-policy.ts",
  "lib/owner-capabilities.ts",
  "lib/oidc-auth.ts",
  "lib/oidc-token.ts",
  "lib/runtime-contracts.ts",
  "lib/agent-control-plane.ts",
  "lib/mcp-configuration.ts",
  "lib/mcp-credential.ts",
  "lib/mcp-control-plane.ts",
  "lib/control-plane-route.ts",
  "lib/runtime-store.ts",
  "app/admin/setup/page.tsx",
  "app/admin/implementation/page.tsx",
  "app/admin/control-center/page.tsx",
  "app/admin/agent-workbench/page.tsx",
  "components/AgentWorkbench.tsx",
  "app/api/agent-missions/route.ts",
  "app/api/approved-evidence/route.ts",
  "app/api/agent-drafts/route.ts",
  "app/api/agent-run-reviews/route.ts",
  "app/api/install/proof-packet/route.ts",
  "db/schema.sql",
  "db/rls.sql",
  "db/004-tenant-oidc.sql",
  "scripts/auth-boundary-smoke.mjs",
  "scripts/identity-policy-smoke.mjs",
  "scripts/oidc-token-smoke.mjs",
  "scripts/identity-schema-contract.mjs",
  "scripts/oidc-database-smoke.mjs",
  "scripts/visual-qa.mjs",
  "scripts/postgres-rls-smoke.mjs",
  "scripts/mcp-control-plane-smoke.mjs",
  "scripts/notification-lifecycle-smoke.mjs",
  "scripts/notification-visual-qa.mjs",
  "db/002-notification-lifecycle.sql",
  "docs/notification-lifecycle.md",
  "app/admin/notifications/page.tsx",
  "app/api/notifications/process/route.ts",
  "lib/weekly-review.ts",
  "components/WeeklyReviewConsole.tsx",
  "app/api/weekly-reviews/route.ts",
  "app/api/weekly-reviews/[id]/complete/route.ts",
  "scripts/weekly-review-smoke.mjs",
  "scripts/weekly-review-visual-qa.mjs",
  "db/003-weekly-owner-review.sql",
  "docs/weekly-owner-review.md",
  "docs/self-service-install.md",
  "docs/implementation-cockpit.md",
  "docs/agent-control-center-spec.md",
  "docs/agent-workbench-spec.md",
  "design-loop-evidence.json",
  "docs/operator-runbook.md"
];

async function fileStatus(file) {
  try {
    await access(path.join(root, file));
    return { file, present: true };
  } catch {
    return { file, present: false };
  }
}

const fileEvidence = await Promise.all(requiredFiles.map(fileStatus));
const selectedRequiredEnv = [...new Set(requiredEnv)];
const selectedOptionalEnv = [...new Set(optionalEnv.filter((name) => !selectedRequiredEnv.includes(name)))];
const missingEnv = selectedRequiredEnv.filter((name) => !process.env[name]);
const notificationReady = Boolean(
  process.env.OWNER_NOTIFICATION_WEBHOOK_URL &&
  process.env.OWNER_NOTIFICATION_WEBHOOK_SIGNING_SECRET &&
  process.env.OWNER_NOTIFICATION_FALLBACK_WEBHOOK_URL &&
  process.env.OWNER_NOTIFICATION_FALLBACK_SIGNING_SECRET &&
  process.env.OWNER_NOTIFICATION_WORKER_TOKEN
);
const phases = [
  {
    id: "fork-and-deploy",
    status: "ready",
    gate: "Local checks and Vercel preview pass before owner review."
  },
  {
    id: "owner-auth",
    status: ownerAuth.configured ? "ready" : "configure",
    gate: ownerAuth.scope === "agency"
      ? "Signed ID-token, PKCE, pre-bound tenant membership, fixed revocable session, role capability, and protected API checks pass."
      : "Private-pilot owner session and protected API smoke tests pass; agencies must select OIDC."
  },
  {
    id: "property-content",
    status: "needs-owner",
    gate: "Owner signs off on facts, media rights, policies, and public address posture."
  },
  {
    id: "runtime-database",
    status: process.env.DATABASE_URL ? "manual" : "configure",
    gate: "Live RLS smoke covers intake, notification, and weekly evidence tables in the dedicated portal database; Railway uses a separate control-plane database."
  },
  {
    id: "agent-substrate",
    status: controlPlane.configured ? "manual" : "configure",
    gate: "Mission, approved evidence, structured draft, and owner review pass through authenticated MCP without silent fallback. Agencies use short-lived OIDC client credentials; external actions remain blocked."
  },
  {
    id: "owner-notifications",
    status: notificationReady ? "manual" : "configure",
    gate: "Signed primary delivery, retry, urgent fallback, and owner acknowledgement leave tenant-scoped receipts."
  },
  {
    id: "weekly-measurement",
    status: process.env.DATABASE_URL ? "manual" : "configure",
    gate: "One tenant-scoped review preserves five met, not-met, or unmeasured observations and performs zero external actions."
  },
  {
    id: "release-and-business-handoff",
    status: "manual",
    gate: "Preview, proof packet, privacy boundary, support scope, and offer ladder are approved."
  }
];

const weight = { ready: 1, manual: 0.72, "needs-owner": 0.58, configure: 0.48, blocked: 0 };
const score = Math.round((phases.reduce((sum, phase) => sum + weight[phase.status], 0) / phases.length) * 100);

const packet = {
  generatedAt: new Date().toISOString(),
  template: {
    name: packageJson.name,
    version: packageJson.version,
    repository: packageJson.repository?.url
  },
  score,
  posture: score >= 75 ? "self-service-installable" : "template-ready-needs-configuration",
  env: {
    authMode: ownerAuth.mode,
    authScope: ownerAuth.scope,
    required: selectedRequiredEnv.map((name) => ({ name, configured: !missingEnv.includes(name) })),
    optional: selectedOptionalEnv.map((name) => ({ name, configured: Boolean(process.env[name]) }))
  },
  fileEvidence,
  phases,
  commandChecks: [
    "npm run validate",
    "npm run typecheck",
    "npm run build",
    "npm run smoke",
    "npm run auth:smoke",
    "npm run identity:smoke",
    "npm run identity:db:smoke",
    "npm run notification:smoke",
    "npm run notification:visual",
    "npm run weekly:smoke",
    "npm run weekly:visual",
    "npm run mcp:smoke",
    "npm run visual:qa",
    "npm run audit",
    "npm run install:proof",
    "npm run db:rls:smoke"
  ],
  publicSafety: {
    secretHandling: "This CLI reports environment key names and configured booleans only; it does not print secret values.",
    dataBoundary: "Approved facts live in GitHub content; private renter submissions require durable runtime storage. Production intake fails closed instead of accepting demo-memory writes.",
    identityBoundary: "Agency mode requires a pre-bound exact issuer/subject membership, signed ID-token claims, and a database session plus role check on every protected request. Portal-wide bearer bypasses are not accepted.",
    databaseBoundary: "Vercel portal and Railway MCP credentials target separate tenant-isolated logical databases and roles; data crosses only through authenticated MCP tools.",
    notificationBoundary: "The outbox stores sanitized summaries and hashes only; signed delivery and acknowledgement never send renter replies or dispatch work.",
    measurementBoundary: "Weekly evidence preserves unmeasured states and the zero-action observation covers only this product's governed action surface.",
    automationBoundary: "Agents draft from server-approved evidence only. Owner review records an outcome but does not apply or send content."
  }
};

const missingFiles = fileEvidence.filter((item) => !item.present);
if (missingFiles.length > 0) {
  console.error(`Install proof failed: missing ${missingFiles.map((item) => item.file).join(", ")}`);
  process.exitCode = 1;
}

console.log(JSON.stringify(packet, null, 2));
