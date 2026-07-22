import { createHash } from "node:crypto";

export type NotificationKind = "inquiry" | "support" | "approval" | "agent-mission" | "agent-run" | "listing-dry-run";
export type NotificationUrgency = "standard" | "urgent" | "weekly";
export type NotificationStatus =
  | "queued"
  | "processing"
  | "sent"
  | "failed"
  | "fallback-required"
  | "fallback-sent"
  | "fallback-failed"
  | "acknowledged";
export type NotificationAction = "send-primary" | "send-fallback";

export type NotificationDelivery = {
  id: string;
  sourceId: string;
  kind: NotificationKind;
  urgency: NotificationUrgency;
  route: string;
  sanitizedSummary: string;
  ownerAction: string;
  payloadHash: string;
  status: NotificationStatus;
  primaryTarget: "owner-webhook" | "none";
  fallbackTarget: "owner-fallback-webhook" | "none";
  primaryAttemptCount: number;
  fallbackAttemptCount: number;
  processingAction: NotificationAction | null;
  nextAttemptAt: string | null;
  claimUntil: string | null;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  fallbackDeliveredAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationPolicy = {
  maxAttempts: number;
  retryBaseMs: number;
  acknowledgementTimeoutMs: number;
  claimLeaseMs: number;
  requestTimeoutMs: number;
  batchSize: number;
};

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    return fallback;
  }
  return parsed;
}

export function notificationPolicy(env: NodeJS.ProcessEnv = process.env): NotificationPolicy {
  return {
    maxAttempts: boundedInteger(env.OWNER_NOTIFICATION_MAX_ATTEMPTS, 3, 1, 5),
    retryBaseMs: boundedInteger(env.OWNER_NOTIFICATION_RETRY_BASE_MS, 60_000, 1_000, 900_000),
    acknowledgementTimeoutMs: boundedInteger(env.OWNER_NOTIFICATION_ACK_TIMEOUT_MS, 300_000, 1_000, 86_400_000),
    claimLeaseMs: boundedInteger(env.OWNER_NOTIFICATION_CLAIM_LEASE_MS, 30_000, 5_000, 300_000),
    requestTimeoutMs: boundedInteger(env.OWNER_NOTIFICATION_REQUEST_TIMEOUT_MS, 6_000, 1_000, 15_000),
    batchSize: boundedInteger(env.OWNER_NOTIFICATION_BATCH_SIZE, 10, 1, 25)
  };
}

export function notificationPayloadHash(input: {
  id: string;
  sourceId: string;
  kind: NotificationKind;
  urgency: NotificationUrgency;
  route: string;
  sanitizedSummary: string;
  ownerAction: string;
  createdAt: string;
}) {
  return createHash("sha256").update(JSON.stringify({
    id: input.id,
    sourceId: input.sourceId,
    kind: input.kind,
    urgency: input.urgency,
    route: input.route,
    sanitizedSummary: input.sanitizedSummary,
    ownerAction: input.ownerAction,
    createdAt: input.createdAt
  })).digest("hex");
}

export function notificationAcknowledgementUrl(id: string, appBaseUrl = process.env.APP_BASE_URL || "") {
  if (!appBaseUrl) return null;
  try {
    const url = new URL("/admin/notifications", appBaseUrl);
    url.searchParams.set("notification", id);
    return url.toString();
  } catch {
    return null;
  }
}

export function notificationWebhookEnvelope(delivery: NotificationDelivery) {
  return {
    schema: "property-os.ownerNotification.v1",
    id: delivery.id,
    idempotencyKey: delivery.id,
    sourceId: delivery.sourceId,
    kind: delivery.kind,
    urgency: delivery.urgency,
    route: delivery.route,
    sanitizedSummary: delivery.sanitizedSummary,
    ownerAction: delivery.ownerAction,
    payloadHash: delivery.payloadHash,
    createdAt: delivery.createdAt,
    acknowledgementRequired: delivery.urgency === "urgent",
    acknowledgementUrl: notificationAcknowledgementUrl(delivery.id),
    contentApplied: false,
    externalActionsPerformed: []
  };
}

export function retryAt(now: Date, completedAttempts: number, policy: NotificationPolicy) {
  const multiplier = 2 ** Math.max(0, completedAttempts - 1);
  return new Date(now.getTime() + Math.min(policy.retryBaseMs * multiplier, 900_000)).toISOString();
}

export function safeNotificationErrorCode(error: unknown) {
  if (error instanceof DOMException && error.name === "TimeoutError") return "timeout";
  if (error instanceof Error && error.name === "AbortError") return "timeout";
  return "network-error";
}
