import packageJson from "@/package.json";
import { implementationReadiness } from "@/lib/implementation";
import { runtimeHealth } from "@/lib/runtime-contracts";

export type InstallProofStatus = "ready" | "needs-owner" | "configure" | "manual" | "blocked";

export type InstallProofPhase = {
  id: string;
  title: string;
  status: InstallProofStatus;
  ownerOutcome: string;
  implementerAction: string;
  evidence: string[];
  commands: string[];
  gate: string;
};

export type InstallCommandCheck = {
  command: string;
  purpose: string;
  requiredBefore: "community-fork" | "owner-preview" | "production";
  requiresLiveSecret: boolean;
};

const proofStatusWeight: Record<InstallProofStatus, number> = {
  ready: 1,
  manual: 0.72,
  "needs-owner": 0.58,
  configure: 0.48,
  blocked: 0
};

export function createInstallProofPacket() {
  const health = runtimeHealth();
  const readiness = implementationReadiness();
  const hasProductionAuth = health.capabilities.auth;
  const hasDatabase = health.capabilities.database;
  const hasNotifications = health.capabilities.ownerNotification;
  const hasAgentSubstrate = health.capabilities.mcpServer && health.capabilities.agentRuntime;

  const installPhases: InstallProofPhase[] = [
    {
      id: "fork-and-deploy",
      title: "Fork, install, and Vercel preview",
      status: "ready",
      ownerOutcome: "The owner or agency can fork the template, run local checks, and open a preview without custom code.",
      implementerAction: "Create the GitHub fork, connect Vercel, keep the first preview private, and run the local fast gates before sharing.",
      evidence: ["README.md", "package.json", "next.config.ts", "Vercel deploy button"],
      commands: ["npm install", "npm run validate", "npm run typecheck", "npm run build"],
      gate: "Preview URL opens, core routes render, and no private owner data has been added to the public fork."
    },
    {
      id: "owner-auth",
      title: "Owner authentication boundary",
      status: hasProductionAuth ? "ready" : "configure",
      ownerOutcome: "Owner, admin, runtime, and proof APIs stay behind a passcode session or trusted automation token.",
      implementerAction: "Generate the owner passcode hash, configure owner secret env names, run the auth smoke test, and keep demo auth off in production.",
      evidence: ["lib/auth.ts", "app/admin/sign-in", "app/api/auth/owner/sign-in", "scripts/auth-boundary-smoke.mjs"],
      commands: ["npm run auth:hash", "npm run auth:smoke"],
      gate: "Protected admin pages and APIs reject anonymous access and accept only the owner session or scoped bearer token."
    },
    {
      id: "property-content",
      title: "Approved property content and media",
      status: "needs-owner",
      ownerOutcome: "The portal answers renters with approved facts, real photos, public-safe address posture, rules, amenities, and FAQ.",
      implementerAction: "Replace sample data, confirm photo rights, mark missing facts, and capture owner sign-off before renter-facing use.",
      evidence: ["data/properties.ts", "owner checklist", "listing missing-fact fields", "docs/operator-runbook.md"],
      commands: ["npm run validate", "npm run privacy"],
      gate: "Owner signs off on facts, photos, price language, public address policy, house rules, and support escalation wording."
    },
    {
      id: "runtime-database",
      title: "Production runtime database and RLS",
      status: hasDatabase ? "manual" : "configure",
      ownerOutcome: "Inquiries, support tickets, approvals, and agent runs persist in tenant-scoped storage instead of demo memory.",
      implementerAction: "Apply schema, RLS, seed organization/property rows, set the organization id, configure backups and retention, then run the live RLS smoke.",
      evidence: ["db/schema.sql", "db/rls.sql", "db/seed-sample.sql", "scripts/postgres-rls-smoke.mjs", "/admin/runtime"],
      commands: ["npm run db:rls:smoke"],
      gate: "Live Postgres install passes RLS isolation, backups are configured, and retention/deletion ownership is documented."
    },
    {
      id: "intake-and-support",
      title: "Inquiry, support, and maintenance triage",
      status: "ready",
      ownerOutcome: "Renters can self-serve common questions and submit structured inquiries or support issues without automatic commitments.",
      implementerAction: "Verify sample forms, review support classification, and connect runtime storage before real renter submissions.",
      evidence: ["/properties/[slug]/inquire", "/support", "lib/product.ts", "lib/runtime-store.ts"],
      commands: ["npm run smoke", "npm run agent:dry-run"],
      gate: "Submitted items create sanitized records and urgent issues route to owner review before any vendor or renter commitment."
    },
    {
      id: "agent-substrate",
      title: "Codex, Claude, MCP, and approval runbooks",
      status: hasAgentSubstrate ? "manual" : "configure",
      ownerOutcome: "Specialist agents can draft listing copy, replies, support summaries, and weekly reviews inside approved-facts boundaries.",
      implementerAction: "Pair with property-os-template, configure MCP and agent runtime endpoints, and dry-run every agent role before owner handoff.",
      evidence: ["property-os-template", "/admin/control-center", "/api/agent-missions", "agent mission and run ledgers", "MCP authority contract"],
      commands: ["npm run agent:dry-run", "npm run mcp:smoke", "npm run install:proof"],
      gate: "The portal records missions through authenticated MCP without a silent local fallback; agents still draft only and consequential outputs require owner approval."
    },
    {
      id: "listing-operations",
      title: "Listing draft studio and channel review",
      status: "manual",
      ownerOutcome: "Owners receive channel-ready drafts for own website, Kleinanzeigen, ImmoScout24, Immowelt, and future approved APIs.",
      implementerAction: "Keep publication manual in v1, evaluate approved APIs or EstateSync later, and never use scraper posting without reviewed terms.",
      evidence: ["/admin/listings", "/admin/integrations", "listing dry-run API", "blocked v1 actions"],
      commands: ["npm run agent:dry-run"],
      gate: "No listing publication happens until the owner approves channel payload, missing facts, terms, and error recovery."
    },
    {
      id: "owner-notifications",
      title: "Owner notification and escalation route",
      status: hasNotifications ? "manual" : "configure",
      ownerOutcome: "Urgent support and approval-required work reaches the owner without exposing secrets or private renter records.",
      implementerAction: "Configure owner email or webhook, decide email/WhatsApp/n8n/Make/Railway worker path, and review notification templates.",
      evidence: ["OWNER_NOTIFICATION_EMAIL", "OWNER_NOTIFICATION_WEBHOOK_URL", "lib/owner-notifications.ts", "support classification"],
      commands: ["npm run smoke"],
      gate: "Owner receives urgent and approval notices with sanitized summaries, no access secrets, and a clear escalation owner."
    },
    {
      id: "release-and-business-handoff",
      title: "Release, visual QA, and business handoff",
      status: "manual",
      ownerOutcome: "The install is ready for premium owner use, partner delivery, or managed-service onboarding with clear proof and pricing path.",
      implementerAction: "Run final checks, verify Vercel preview on desktop and mobile, export proof packet, and package the offer ladder for the owner or agency.",
      evidence: ["TEMPLATE_READINESS.md", "docs/self-service-install.md", "docs/implementation-cockpit.md", "docs/success-criteria.md", "design-loop-evidence.json"],
      commands: ["npm run validate", "npm run typecheck", "npm run build", "npm run smoke", "npm run auth:smoke", "npm run visual:qa", "npm run audit", "npm run install:proof"],
      gate: "Owner approves preview, proof packet, private-data boundary, support scope, and go-live checklist before production."
    }
  ];

  const commandChecks: InstallCommandCheck[] = [
    {
      command: "npm run validate",
      purpose: "Content, privacy, and agent dry-run validation.",
      requiredBefore: "community-fork",
      requiresLiveSecret: false
    },
    {
      command: "npm run typecheck",
      purpose: "TypeScript contract check for the portal and API routes.",
      requiredBefore: "community-fork",
      requiresLiveSecret: false
    },
    {
      command: "npm run build",
      purpose: "Next.js production build verification.",
      requiredBefore: "owner-preview",
      requiresLiveSecret: false
    },
    {
      command: "npm run smoke",
      purpose: "Route, inquiry, support, listing, runtime, and owner surface smoke test.",
      requiredBefore: "owner-preview",
      requiresLiveSecret: false
    },
    {
      command: "npm run mcp:smoke",
      purpose: "Verify the authenticated portal-to-MCP mission contract and partial-configuration denial.",
      requiredBefore: "owner-preview",
      requiresLiveSecret: false
    },
    {
      command: "npm run auth:smoke",
      purpose: "Protected owner/admin pages and APIs reject anonymous access and accept only approved access.",
      requiredBefore: "owner-preview",
      requiresLiveSecret: false
    },
    {
      command: "npm run visual:qa",
      purpose: "Capture exact desktop/mobile evidence and reject horizontal overflow or clipped control text.",
      requiredBefore: "owner-preview",
      requiresLiveSecret: false
    },
    {
      command: "npm run audit",
      purpose: "Reject known moderate-or-higher dependency vulnerabilities.",
      requiredBefore: "owner-preview",
      requiresLiveSecret: false
    },
    {
      command: "npm run install:proof",
      purpose: "Export the self-service proof packet without printing secret values.",
      requiredBefore: "owner-preview",
      requiresLiveSecret: false
    },
    {
      command: "npm run db:rls:smoke",
      purpose: "Verify live Postgres tenant isolation and RLS enforcement.",
      requiredBefore: "production",
      requiresLiveSecret: true
    }
  ];

  const score = Math.round(
    (installPhases.reduce((sum, phase) => sum + proofStatusWeight[phase.status], 0) / installPhases.length) * 100
  );

  const nextActions = installPhases
    .filter((phase) => phase.status !== "ready")
    .map((phase) => ({
      phaseId: phase.id,
      title: phase.title,
      status: phase.status,
      action: phase.implementerAction,
      gate: phase.gate
    }));

  return {
    generatedAt: new Date().toISOString(),
    template: {
      name: packageJson.name,
      version: packageJson.version,
      repository: packageJson.repository.url
    },
    score,
    posture: score >= 75 ? "self-service-installable" : "template-ready-needs-configuration",
    implementationScore: readiness.score,
    runtimeMode: readiness.runtimeMode,
    tenantModel: readiness.tenantModel,
    capabilities: readiness.capabilities,
    requiredEnv: readiness.missingEnv.map((name) => ({ name, configured: false })),
    optionalEnv: health.optionalEnv.map((name) => ({ name, configured: Boolean(process.env[name]) })),
    ownerApprovalRequiredFor: readiness.ownerApprovalRequiredFor,
    blockedV1Actions: readiness.blockedV1Actions,
    installPhases,
    commandChecks,
    nextActions,
    publicSafety: {
      secretHandling: "The proof packet reports environment key names and configured booleans only; it does not print secret values.",
      dataBoundary: "Approved property facts live in GitHub content; renter submissions and approvals belong in protected runtime storage.",
      automationBoundary: "Agents draft and summarize only; consequential renter, listing, pricing, legal, access, repair, and payment actions require owner approval."
    }
  };
}
