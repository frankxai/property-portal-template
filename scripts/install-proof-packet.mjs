import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

const requiredEnv = [
  "DATABASE_URL",
  "APP_BASE_URL",
  "OWNER_NOTIFICATION_EMAIL",
  "OWNER_PORTAL_SECRET",
  "OWNER_PORTAL_PASSCODE_HASH"
];

const optionalEnv = [
  "AUTH_PROVIDER",
  "OWNER_ADMIN_EMAIL",
  "OWNER_PORTAL_API_TOKEN",
  "PROPERTY_OS_DEMO_AUTH",
  "MCP_SERVER_URL",
  "AGENT_RUNTIME_URL",
  "OWNER_NOTIFICATION_WEBHOOK_URL"
];

const requiredFiles = [
  "README.md",
  "TEMPLATE_READINESS.md",
  "data/properties.ts",
  "lib/install-proof.ts",
  "lib/auth.ts",
  "lib/runtime-contracts.ts",
  "lib/runtime-store.ts",
  "app/admin/setup/page.tsx",
  "app/admin/implementation/page.tsx",
  "app/api/install/proof-packet/route.ts",
  "db/schema.sql",
  "db/rls.sql",
  "scripts/auth-boundary-smoke.mjs",
  "scripts/postgres-rls-smoke.mjs",
  "docs/self-service-install.md",
  "docs/implementation-cockpit.md",
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
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
const phases = [
  {
    id: "fork-and-deploy",
    status: "ready",
    gate: "Local checks and Vercel preview pass before owner review."
  },
  {
    id: "owner-auth",
    status: process.env.OWNER_PORTAL_SECRET && process.env.OWNER_PORTAL_PASSCODE_HASH ? "ready" : "configure",
    gate: "Owner session and protected API smoke tests pass."
  },
  {
    id: "property-content",
    status: "needs-owner",
    gate: "Owner signs off on facts, media rights, policies, and public address posture."
  },
  {
    id: "runtime-database",
    status: process.env.DATABASE_URL ? "manual" : "configure",
    gate: "Live RLS smoke passes against the production database."
  },
  {
    id: "agent-substrate",
    status: process.env.MCP_SERVER_URL && process.env.AGENT_RUNTIME_URL ? "manual" : "configure",
    gate: "Agents draft only and owner approval blocks consequential outputs."
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
    required: requiredEnv.map((name) => ({ name, configured: !missingEnv.includes(name) })),
    optional: optionalEnv.map((name) => ({ name, configured: Boolean(process.env[name]) }))
  },
  fileEvidence,
  phases,
  commandChecks: [
    "npm run validate",
    "npm run typecheck",
    "npm run build",
    "npm run smoke",
    "npm run auth:smoke",
    "npm run install:proof",
    "npm run db:rls:smoke"
  ],
  publicSafety: {
    secretHandling: "This CLI reports environment key names and configured booleans only; it does not print secret values.",
    dataBoundary: "Approved facts live in GitHub content; private renter submissions belong in runtime storage.",
    automationBoundary: "Agents draft and summarize only until owner approval is recorded."
  }
};

const missingFiles = fileEvidence.filter((item) => !item.present);
if (missingFiles.length > 0) {
  console.error(`Install proof failed: missing ${missingFiles.map((item) => item.file).join(", ")}`);
  process.exitCode = 1;
}

console.log(JSON.stringify(packet, null, 2));
