import type { AgentRole, ApprovalRisk, ListingChannel } from "@/lib/types";

export type RuntimeMode = "demo" | "database-ready";
export type RuntimeNotificationMode = "not-configured" | "email-target-only" | "webhook-ready";
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
  | "listing_dry_run.created";

export type RuntimeHealth = {
  mode: RuntimeMode;
  tenantModel: "single-demo" | "multi-tenant-ready";
  adapter: RuntimeAdapterName;
  notificationMode: RuntimeNotificationMode;
  requiredEnv: string[];
  optionalEnv: string[];
  missingEnv: string[];
  capabilities: {
    database: boolean;
    ownerNotification: boolean;
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

const requiredRuntimeEnv = ["DATABASE_URL", "APP_BASE_URL", "OWNER_NOTIFICATION_EMAIL"];
const requiredProductionEnv = ["OWNER_PORTAL_SECRET", "OWNER_PORTAL_PASSCODE_HASH"];
const optionalRuntimeEnv = [
  "AUTH_PROVIDER",
  "OWNER_ADMIN_EMAIL",
  "OWNER_PORTAL_API_TOKEN",
  "PROPERTY_OS_DEMO_AUTH",
  "MCP_SERVER_URL",
  "AGENT_RUNTIME_URL",
  "OWNER_NOTIFICATION_WEBHOOK_URL"
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
  const missingEnv = [...requiredRuntimeEnv, ...requiredProductionEnv].filter((name) => !process.env[name]);
  const notificationMode: RuntimeNotificationMode = process.env.OWNER_NOTIFICATION_WEBHOOK_URL
    ? "webhook-ready"
    : process.env.OWNER_NOTIFICATION_EMAIL
      ? "email-target-only"
      : "not-configured";

  return {
    mode: missingEnv.includes("DATABASE_URL") ? "demo" : "database-ready",
    tenantModel: missingEnv.includes("DATABASE_URL") ? "single-demo" : "multi-tenant-ready",
    adapter: missingEnv.includes("DATABASE_URL") ? "demo-memory" : "postgres",
    notificationMode,
    requiredEnv: [...requiredRuntimeEnv, ...requiredProductionEnv],
    optionalEnv: optionalRuntimeEnv,
    missingEnv,
    capabilities: {
      database: Boolean(process.env.DATABASE_URL),
      ownerNotification: notificationMode !== "not-configured",
      auth: Boolean(process.env.OWNER_PORTAL_SECRET && process.env.OWNER_PORTAL_PASSCODE_HASH),
      mcpServer: Boolean(process.env.MCP_SERVER_URL),
      agentRuntime: Boolean(process.env.AGENT_RUNTIME_URL)
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
