import type { InquiryPayload, SupportPayload } from "@/lib/types";
import { classifySupport } from "@/lib/product";
import { notifyOwner, type OwnerNotificationReceipt } from "@/lib/owner-notifications";
import { persistInquiryIntake, persistSupportIntake, type RuntimePersistenceReceipt } from "@/lib/runtime-store";
import { blockedV1Actions, createApprovalRecord, createAuditEvent, createRuntimeId, runtimeHealth } from "@/lib/runtime-contracts";

export type RuntimeResult = {
  id: string;
  mode: "demo" | "database-ready";
  ownerApprovalRequired: boolean;
  sanitizedSummary: string;
  route: string;
  ownerAction: string;
  approvalId: string;
  auditEventId: string;
  persistence: RuntimePersistenceReceipt;
  approvalPersistence: RuntimePersistenceReceipt;
  ownerNotification: OwnerNotificationReceipt;
  blockedActions: string[];
};

export async function recordInquiry(payload: InquiryPayload, ownerApprovalRequired: boolean): Promise<RuntimeResult> {
  const id = createRuntimeId("inq");
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
  const approvalAuditEvent = createAuditEvent({
    type: "approval.requested",
    actorRole: "system",
    summary: `Inquiry approval requested for ${id}`
  });
  const item = {
    id,
    kind: "inquiry" as const,
    route,
    sanitizedSummary: `Inquiry for ${payload.propertySlug}: ${payload.rentalWindow}`,
    ownerAction,
    ownerApprovalRequired,
    createdAt: auditEvent.createdAt
  };
  const { persistence, approvalPersistence } = await persistInquiryIntake({
    payload,
    item,
    auditEvent,
    approval,
    approvalAuditEvent
  });
  if (persistence.status !== "recorded" || approvalPersistence.status !== "recorded") {
    throw new Error("Durable inquiry intake is unavailable.");
  }
  const ownerNotification = await notifyOwner({
    sourceId: id,
    kind: "inquiry",
    urgency: "standard",
    route,
    sanitizedSummary: item.sanitizedSummary,
    ownerAction
  });

  return {
    id,
    mode: runtimeHealth().mode,
    ownerApprovalRequired,
    sanitizedSummary: item.sanitizedSummary,
    route,
    ownerAction,
    approvalId: approval.id,
    auditEventId: auditEvent.id,
    persistence,
    approvalPersistence,
    ownerNotification,
    blockedActions: blockedV1Actions
  };
}

export async function recordSupport(payload: SupportPayload, ownerApprovalRequired: boolean): Promise<RuntimeResult> {
  const id = createRuntimeId("sup");
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
  const approvalAuditEvent = createAuditEvent({
    type: "approval.requested",
    actorRole: "system",
    summary: `Support triage approval requested for ${id}`
  });
  const item = {
    id,
    kind: "support" as const,
    route: classification.route,
    sanitizedSummary: `${payload.urgency} ${payload.category} support item for ${payload.propertySlug}`,
    ownerAction: classification.responsePolicy,
    ownerApprovalRequired: ownerApprovalRequired || classification.ownerApprovalRequired,
    createdAt: auditEvent.createdAt
  };
  const { persistence, approvalPersistence } = await persistSupportIntake({
    payload,
    item,
    auditEvent,
    approval,
    approvalAuditEvent
  });
  if (persistence.status !== "recorded" || approvalPersistence.status !== "recorded") {
    throw new Error("Durable support intake is unavailable.");
  }
  const ownerNotification = await notifyOwner({
    sourceId: id,
    kind: "support",
    urgency: classification.route === "urgent-owner-escalation" ? "urgent" : "standard",
    route: classification.route,
    sanitizedSummary: item.sanitizedSummary,
    ownerAction: classification.responsePolicy
  });

  return {
    id,
    mode: runtimeHealth().mode,
    ownerApprovalRequired: item.ownerApprovalRequired,
    sanitizedSummary: item.sanitizedSummary,
    route: classification.route,
    ownerAction: classification.responsePolicy,
    approvalId: approval.id,
    auditEventId: auditEvent.id,
    persistence,
    approvalPersistence,
    ownerNotification,
    blockedActions: blockedV1Actions
  };
}
