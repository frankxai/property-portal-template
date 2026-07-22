import { createHmac } from "node:crypto";
import {
  notificationPolicy,
  notificationWebhookEnvelope,
  safeNotificationErrorCode,
  type NotificationAction,
  type NotificationDelivery
} from "@/lib/notification-policy";
import { claimDueNotificationDeliveries, completeNotificationDelivery } from "@/lib/runtime-store";

type WebhookTarget = {
  url: URL;
  signingSecret: string;
};

function safeWebhookTarget(action: NotificationAction): WebhookTarget | null {
  const rawUrl = action === "send-primary"
    ? process.env.OWNER_NOTIFICATION_WEBHOOK_URL
    : process.env.OWNER_NOTIFICATION_FALLBACK_WEBHOOK_URL;
  const signingSecret = action === "send-primary"
    ? process.env.OWNER_NOTIFICATION_WEBHOOK_SIGNING_SECRET
    : process.env.OWNER_NOTIFICATION_FALLBACK_SIGNING_SECRET;
  if (!rawUrl || !signingSecret || signingSecret.length < 24) return null;

  try {
    const url = new URL(rawUrl);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    return { url, signingSecret };
  } catch {
    return null;
  }
}

async function deliverNotification(delivery: NotificationDelivery, action: NotificationAction, target: WebhookTarget) {
  const policy = notificationPolicy();
  const envelope = notificationWebhookEnvelope(delivery);
  const body = JSON.stringify(envelope);
  const timestamp = new Date().toISOString();
  const signature = createHmac("sha256", target.signingSecret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  try {
    const response = await fetch(target.url, {
      method: "POST",
      redirect: "error",
      headers: {
        "content-type": "application/json",
        "x-property-os-event": "owner.notification",
        "x-property-os-idempotency-key": delivery.id,
        "x-property-os-timestamp": timestamp,
        "x-property-os-signature": `v1=${signature}`
      },
      body,
      signal: AbortSignal.timeout(policy.requestTimeoutMs)
    });
    return response.ok
      ? { succeeded: true, errorCode: null }
      : { succeeded: false, errorCode: `http-${response.status}` };
  } catch (error) {
    return { succeeded: false, errorCode: safeNotificationErrorCode(error) };
  }
}

export async function processNotificationQueue(input: { now?: Date; limit?: number } = {}) {
  const claims = await claimDueNotificationDeliveries(input);
  const results = [];

  for (const claim of claims) {
    const target = safeWebhookTarget(claim.claimedAction);
    const attempt = target
      ? await deliverNotification(claim, claim.claimedAction, target)
      : { succeeded: false, errorCode: "provider-not-configured" };
    const completed = await completeNotificationDelivery({
      id: claim.id,
      action: claim.claimedAction,
      succeeded: attempt.succeeded,
      providerConfigured: Boolean(target),
      errorCode: attempt.errorCode,
      now: input.now
    });

    results.push({
      id: claim.id,
      action: claim.claimedAction,
      status: completed?.status ?? "recording-failed",
      payloadHash: claim.payloadHash,
      deliveryAttempted: Boolean(target),
      externalActionsPerformed: []
    });
  }

  return {
    claimed: claims.length,
    completed: results.filter((item) => item.status !== "recording-failed").length,
    failedToRecord: results.filter((item) => item.status === "recording-failed").length,
    results
  };
}
