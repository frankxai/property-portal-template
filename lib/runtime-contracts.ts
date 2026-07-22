import type { AgentRole, ApprovalRisk, ListingChannel } from "@/lib/types";
import { oidcAuthEnv, ownerAuthStatus, staticPrivatePilotAuthEnv } from "./auth-configuration.ts";
import { controlPlaneConfiguration } from "./mcp-configuration.ts";

export type RuntimeMode = "demo" | "database-ready";
export type RuntimeNotificationMode = "not-configured" | "webhook-incomplete" | "webhook-ready" | "webhook-fallback-ready";
export type RuntimeAdapterName = "demo-memory" | "postgres";

export type RuntimeActorRole = "owner" | "operator" | "agent" | "renter" | "system";

export type ApprovalKind =
  | "inquiry-reply"
  | "support-triage"
  | "listing-publication"
  | "agent-output"
  | "integration-dry-run";

export type AuditEventType =
  | "inquiry.created"
  | "support.created"
  | "approval.requested"
  | "agent_mission.created"
  | "agent_run.logged"
  | "listing_dry_run.created"
  | "weekly_review.started"
  | "weekly_review.completed";

export type RuntimeHealth = {
  mode: RuntimeMode;
  tenantModel: "single-demo" | "multi-tenant-ready";
  adapter: RuntimeAdapterName;
  notificationMode: RuntimeNotificationMode;
  mcpMode: "disabled" | "partial" | "connected";
  requiredEnv: string[];
  optionalEnv: string[];
  missingEnv: string[];
  capabilities: {
    database: boolean;
    ownerNotification: boolean;
    notificationFallback: boolean;
    auth: boolean;
    mcpServer: boolean;
    agentRuntime: boolean;
  };
  blockedV1Actions: string[];
  ownerApprovalRequiredFor: string[];
};

export type ApprovalRecord = {
  id: string;
  kind: ApprovalKind;
  sourceId: string;
  route: string;
  status: "owner-review";
  ownerAction: string;
  createdAt: string;
};

export type AuditEvent = {
  id: string;
  type: AuditEventType;
  actorRole: RuntimeActorRole;
  summary: string;
  createdAt: string;
};

export type AgentRunPayload = {
  role: AgentRole;
  trigger: string;
  output: string;
  approvalRisk: ApprovalRisk;
};

export type AgentMissionStatus = "planned" | "grounding" | "drafting" | "owner-review" | "verified" | "stopped";

export type AgentMission = {
  id: string;
  role: AgentRole;
  propertySlug: string | null;
  objective: string;
  successMetric: string;
  status: AgentMissionStatus;
  authority: "draft-only";
  ownerApprovalRequired: true;
  stages: string[];
  ownerAction: string;
  createdAt: string;
};

export type ListingDryRunPayload = {
  propertySlug: string;
  channel: ListingChannel;
};

const requiredRuntimeEnv = ["DATABASE_URL", "APP_BASE_URL"];
const requiredNotificationEnv = [
  "OWNER_NOTIFICATION_WEBHOOK_URL",
  "OWNER_NOTIFICATION_WEBHOOK_SIGNING_SECRET",
  "OWNER_NOTIFICATION_FALLBACK_WEBHOOK_URL",
  "OWNER_NOTIFICATION_FALLBACK_SIGNING_SECRET",
  "OWNER_NOTIFICATION_WORKER_TOKEN"
];
const optionalRuntimeEnv = [
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

export const blockedV1Actions = [
  "publish listing",
  "send renter message",
  "dispatch vendor",
  "approve applicant",
  "disclose access secret",
  "change price or availability"
];

export const ownerApprovalRequiredFor = [
  "pricing",
  "availability",
  "lease terms",
  "refunds",
  "urgent repairs",
  "vendor dispatch",
  "listing publication",
  "renter-facing messages",
  "access information"
];

export function runtimeHealth(): RuntimeHealth {
  const auth = ownerAuthStatus();
  const mcp = controlPlaneConfiguration();
  const selectedMcpRequired = mcp.configured || mcp.partial ? mcp.requiredEnv : [];
  const conditionalMcpEnv = mcp.missingEnv;
  const webhookConfigured = Boolean(process.env.OWNER_NOTIFICATION_WEBHOOK_URL);
  const webhookSigned = Boolean(process.env.OWNER_NOTIFICATION_WEBHOOK_SIGNING_SECRET);
  const workerConfigured = Boolean(process.env.OWNER_NOTIFICATION_WORKER_TOKEN);
  const fallbackConfigured = Boolean(process.env.OWNER_NOTIFICATION_FALLBACK_WEBHOOK_URL);
  const fallbackSigned = Boolean(process.env.OWNER_NOTIFICATION_FALLBACK_SIGNING_SECRET);
  const missingEnv = [...new Set([
    ...[...requiredRuntimeEnv, ...auth.requiredEnv, ...requiredNotificationEnv].filter((name) => !process.env[name]?.trim()),
    ...conditionalMcpEnv
  ])];
  const primaryNotificationReady = webhookConfigured && webhookSigned && workerConfigured;
  const fallbackNotificationReady = fallbackConfigured && fallbackSigned;
  const notificationPartiallyConfigured = [
    webhookConfigured,
    webhookSigned,
    workerConfigured,
    fallbackConfigured,
    fallbackSigned
  ].some(Boolean);
  const notificationMode: RuntimeNotificationMode = primaryNotificationReady && fallbackNotificationReady
    ? "webhook-fallback-ready"
    : primaryNotificationReady
      ? "webhook-ready"
      : notificationPartiallyConfigured
        ? "webhook-incomplete"
        : "not-configured";

  return {
    mode: missingEnv.includes("DATABASE_URL") ? "demo" : "database-ready",
    tenantModel: missingEnv.includes("DATABASE_URL") ? "single-demo" : "multi-tenant-ready",
    adapter: missingEnv.includes("DATABASE_URL") ? "demo-memory" : "postgres",
    notificationMode,
    mcpMode: mcp.configured ? "connected" : mcp.partial ? "partial" : "disabled",
    requiredEnv: [...new Set([...requiredRuntimeEnv, ...auth.requiredEnv, ...requiredNotificationEnv, ...selectedMcpRequired])],
    optionalEnv: [...new Set(optionalRuntimeEnv.filter((name) => !auth.requiredEnv.includes(name) && !selectedMcpRequired.includes(name)))],
    missingEnv,
    capabilities: {
      database: Boolean(process.env.DATABASE_URL),
      ownerNotification: primaryNotificationReady,
      notificationFallback: primaryNotificationReady && fallbackNotificationReady,
      auth: auth.configured && auth.productionSafe,
      mcpServer: mcp.configured,
      agentRuntime: mcp.configured
    },
    blockedV1Actions,
    ownerApprovalRequiredFor
  };
}

export function createRuntimeId(prefix: string) {
  return `${prefix}-${Date.now()}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
}

export function createApprovalRecord(input: {
  kind: ApprovalKind;
  sourceId: string;
  route: string;
  ownerAction: string;
}): ApprovalRecord {
  return {
    id: createRuntimeId("appr"),
    kind: input.kind,
    sourceId: input.sourceId,
    route: input.route,
    status: "owner-review",
    ownerAction: input.ownerAction,
    createdAt: new Date().toISOString()
  };
}

export function createAuditEvent(input: {
  type: AuditEventType;
  actorRole?: RuntimeActorRole;
  summary: string;
}): AuditEvent {
  return {
    id: createRuntimeId("audit"),
    type: input.type,
    actorRole: input.actorRole ?? "system",
    summary: input.summary,
    createdAt: new Date().toISOString()
  };
}

export function createAgentRun(input: AgentRunPayload) {
  const id = createRuntimeId("run");
  const ownerApprovalRequired = input.approvalRisk !== "low";
  const ownerAction = ownerApprovalRequired
    ? "Review, edit, and approve before this output leaves the workspace."
    : "Review during weekly owner check before reuse.";

  return {
    id,
    mode: runtimeHealth().mode,
    ownerApprovalRequired,
    route: ownerApprovalRequired ? "owner-agent-review" : "weekly-owner-review",
    ownerAction,
    sanitizedSummary: `${input.role} produced ${input.approvalRisk} risk output.`,
    auditEvent: createAuditEvent({
      type: "agent_run.logged",
      actorRole: "agent",
      summary: `${input.role}: ${input.trigger.slice(0, 140)}`
    })
  };
}

export function createAgentMission(input: {
  role: AgentRole;
  propertySlug?: string;
  objective: string;
  successMetric: string;
}): AgentMission {
  return {
    id: createRuntimeId("mission"),
    role: input.role,
    propertySlug: input.propertySlug || null,
    objective: input.objective,
    successMetric: input.successMetric,
    status: "planned",
    authority: "draft-only",
    ownerApprovalRequired: true,
    stages: ["observe", "draft", "review", "decide", "apply", "verify"],
    ownerAction: "Review the mission objective and evidence gate before any agent output is reused.",
    createdAt: new Date().toISOString()
  };
}

export function createListingDryRun(input: ListingDryRunPayload) {
  return {
    id: createRuntimeId("dryrun"),
    mode: runtimeHealth().mode,
    ownerApprovalRequired: true,
    route: "owner-listing-publication-review",
    ownerAction: "Review missing facts and channel payload before any manual or API publication.",
    sanitizedSummary: `Dry-run payload prepared for ${input.channel} on ${input.propertySlug}.`,
    blockedActions: blockedV1Actions,
    auditEvent: createAuditEvent({
      type: "listing_dry_run.created",
      actorRole: "agent",
      summary: `${input.channel} dry run for ${input.propertySlug}`
    })
  };
}
