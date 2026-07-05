import type { InquiryPayload, SupportPayload } from "@/lib/types";
import { classifySupport } from "@/lib/product";
import { blockedV1Actions, createApprovalRecord, createAuditEvent, runtimeHealth } from "@/lib/runtime-contracts";

export type RuntimeResult = {
  id: string;
  mode: "demo" | "database-ready";
  ownerApprovalRequired: boolean;
  sanitizedSummary: string;
  route: string;
  ownerAction: string;
  approvalId: string;
  auditEventId: string;
  blockedActions: string[];
};

export async function recordInquiry(payload: InquiryPayload, ownerApprovalRequired: boolean): Promise<RuntimeResult> {
  const id = `inq-${Date.now()}`;
  const route = "owner-inquiry-review";
  const ownerAction = "Approve reply, request missing facts, or reject the inquiry manually.";
  const approval = createApprovalRecord({
    kind: "inquiry-reply",
    sourceId: id,
    route,
    ownerAction
  });
  const auditEvent = createAuditEvent({
    type: "inquiry.created",
    actorRole: "renter",
    summary: `Inquiry for ${payload.propertySlug}: ${payload.rentalWindow}`
  });

  return {
    id,
    mode: runtimeHealth().mode,
    ownerApprovalRequired,
    sanitizedSummary: `Inquiry for ${payload.propertySlug}: ${payload.rentalWindow}`,
    route,
    ownerAction,
    approvalId: approval.id,
    auditEventId: auditEvent.id,
    blockedActions: blockedV1Actions
  };
}

export async function recordSupport(payload: SupportPayload, ownerApprovalRequired: boolean): Promise<RuntimeResult> {
  const id = `sup-${Date.now()}`;
  const classification = classifySupport(payload);
  const approval = createApprovalRecord({
    kind: "support-triage",
    sourceId: id,
    route: classification.route,
    ownerAction: classification.responsePolicy
  });
  const auditEvent = createAuditEvent({
    type: "support.created",
    actorRole: "renter",
    summary: `${payload.urgency} ${payload.category} support item for ${payload.propertySlug}`
  });

  return {
    id,
    mode: runtimeHealth().mode,
    ownerApprovalRequired: ownerApprovalRequired || classification.ownerApprovalRequired,
    sanitizedSummary: `${payload.urgency} ${payload.category} support item for ${payload.propertySlug}`,
    route: classification.route,
    ownerAction: classification.responsePolicy,
    approvalId: approval.id,
    auditEventId: auditEvent.id,
    blockedActions: blockedV1Actions
  };
}
