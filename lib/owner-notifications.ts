import { createRuntimeId, runtimeHealth } from "@/lib/runtime-contracts";
import {
  notificationPayloadHash,
  type NotificationDelivery,
  type NotificationKind,
  type NotificationUrgency
} from "@/lib/notification-policy";
import { persistNotification, type RuntimePersistenceReceipt } from "@/lib/runtime-store";

export type OwnerNotificationInput = {
  sourceId: string;
  kind: NotificationKind;
  urgency: NotificationUrgency;
  route: string;
  sanitizedSummary: string;
  ownerAction: string;
};

export type OwnerNotificationReceipt = {
  id: string;
  mode: ReturnType<typeof runtimeHealth>["notificationMode"];
  status: "skipped" | "queued" | "failed";
  lifecycleStatus: NotificationDelivery["status"];
  target: NotificationDelivery["primaryTarget"];
  fallbackTarget: NotificationDelivery["fallbackTarget"];
  payloadHash: string;
  acknowledgementRequired: boolean;
  deliveryAttempted: false;
  persistence: RuntimePersistenceReceipt;
  detail: string;
};

function primaryTarget(): NotificationDelivery["primaryTarget"] {
  if (process.env.OWNER_NOTIFICATION_WEBHOOK_URL) return "owner-webhook";
  return "none";
}

function fallbackTarget(): NotificationDelivery["fallbackTarget"] {
  return process.env.OWNER_NOTIFICATION_FALLBACK_WEBHOOK_URL ? "owner-fallback-webhook" : "none";
}

export async function notifyOwner(input: OwnerNotificationInput): Promise<OwnerNotificationReceipt> {
  const health = runtimeHealth();
  const id = createRuntimeId("notif");
  const createdAt = new Date().toISOString();
  const target = primaryTarget();
  const fallback = fallbackTarget();
  const status: NotificationDelivery["status"] = target === "none" && input.urgency === "urgent"
    ? "fallback-required"
    : "queued";
  const payloadHash = notificationPayloadHash({ id, createdAt, ...input });
  const delivery: NotificationDelivery = {
    id,
    sourceId: input.sourceId,
    kind: input.kind,
    urgency: input.urgency,
    route: input.route,
    sanitizedSummary: input.sanitizedSummary,
    ownerAction: input.ownerAction,
    payloadHash,
    status,
    primaryTarget: target,
    fallbackTarget: fallback,
    primaryAttemptCount: 0,
    fallbackAttemptCount: 0,
    processingAction: null,
    nextAttemptAt: status === "queued" || fallback !== "none" ? createdAt : null,
    claimUntil: null,
    lastAttemptAt: null,
    deliveredAt: null,
    fallbackDeliveredAt: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    lastErrorCode: null,
    createdAt,
    updatedAt: createdAt
  };

  const persistence = await persistNotification(delivery);
  if (persistence.status === "failed") {
    return {
      id,
      mode: health.notificationMode,
      status: "failed",
      lifecycleStatus: status,
      target,
      fallbackTarget: fallback,
      payloadHash,
      acknowledgementRequired: input.urgency === "urgent",
      deliveryAttempted: false,
      persistence,
      detail: "Notification outbox write failed. No provider delivery was attempted; keep the manual owner route active."
    };
  }

  const configured = target === "owner-webhook" || fallback === "owner-fallback-webhook";
  return {
    id,
    mode: health.notificationMode,
    status: configured ? "queued" : "skipped",
    lifecycleStatus: status,
    target,
    fallbackTarget: fallback,
    payloadHash,
    acknowledgementRequired: input.urgency === "urgent",
    deliveryAttempted: false,
    persistence,
    detail: configured
      ? "Sanitized notification is durably queued. The scoped worker performs delivery, retry, fallback, and acknowledgement tracking."
      : "No signed webhook route is configured. The owner action remains visible for manual review."
  };
}
