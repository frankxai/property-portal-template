import type { AgentRole, ApprovalRisk, ListingChannel } from "@/lib/types";

export type RuntimeMode = "demo" | "database-ready";

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
  | "agent_run.logged"
  | "listing_dry_run.created";

export type RuntimeHealth = {
  mode: RuntimeMode;
  tenantModel: "single-demo" | "multi-tenant-ready";
  requiredEnv: string[];
  missingEnv: string[];
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

export type ListingDryRunPayload = {
  propertySlug: string;
  channel: ListingChannel;
};

const requiredRuntimeEnv = ["DATABASE_URL", "APP_BASE_URL", "OWNER_NOTIFICATION_EMAIL"];

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
  const missingEnv = requiredRuntimeEnv.filter((name) => !process.env[name]);
  return {
    mode: missingEnv.includes("DATABASE_URL") ? "demo" : "database-ready",
    tenantModel: missingEnv.includes("DATABASE_URL") ? "single-demo" : "multi-tenant-ready",
    requiredEnv: requiredRuntimeEnv,
    missingEnv,
    blockedV1Actions,
    ownerApprovalRequiredFor
  };
}

export function createApprovalRecord(input: {
  kind: ApprovalKind;
  sourceId: string;
  route: string;
  ownerAction: string;
}): ApprovalRecord {
  return {
    id: `appr-${Date.now()}`,
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
    id: `audit-${Date.now()}`,
    type: input.type,
    actorRole: input.actorRole ?? "system",
    summary: input.summary,
    createdAt: new Date().toISOString()
  };
}

export function createAgentRun(input: AgentRunPayload) {
  const id = `run-${Date.now()}`;
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

export function createListingDryRun(input: ListingDryRunPayload) {
  return {
    id: `dryrun-${Date.now()}`,
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
