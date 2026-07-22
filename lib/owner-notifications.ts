import { createRuntimeId, runtimeHealth } from "@/lib/runtime-contracts";
import { persistNotification, type RuntimeQueueItem } from "@/lib/runtime-store";

export type OwnerNotificationInput = {
  sourceId: string;
  kind: "inquiry" | "support" | "approval" | "agent-mission" | "agent-run" | "listing-dry-run";
  urgency: "standard" | "urgent" | "weekly";
  route: string;
  sanitizedSummary: string;
  ownerAction: string;
};

export type OwnerNotificationReceipt = {
  id: string;
  mode: "not-configured" | "email-target-only" | "webhook-ready";
  status: "skipped" | "queued" | "sent" | "failed";
  target: string;
  detail: string;
};

function safeTarget() {
  if (process.env.OWNER_NOTIFICATION_WEBHOOK_URL) return "owner-webhook";
  if (process.env.OWNER_NOTIFICATION_EMAIL) return "owner-email";
  return "none";
}

export async function notifyOwner(input: OwnerNotificationInput): Promise<OwnerNotificationReceipt> {
  const health = runtimeHealth();
  const id = createRuntimeId("notif");
  const createdAt = new Date().toISOString();
  const item: RuntimeQueueItem = {
    id,
    kind: "notification",
    route: input.route,
    sanitizedSummary: `${input.kind}: ${input.sanitizedSummary}`,
    ownerAction: input.ownerAction,
    ownerApprovalRequired: true,
    createdAt
  };

  await persistNotification(item);

  if (!process.env.OWNER_NOTIFICATION_EMAIL && !process.env.OWNER_NOTIFICATION_WEBHOOK_URL) {
    return {
      id,
      mode: health.notificationMode,
      status: "skipped",
      target: safeTarget(),
      detail: "Owner notification is not configured. Runtime result still returns owner action for manual review."
    };
  }

  if (!process.env.OWNER_NOTIFICATION_WEBHOOK_URL) {
    return {
      id,
      mode: health.notificationMode,
      status: "queued",
      target: safeTarget(),
      detail: "Owner email target is configured. Wire an email provider or notification worker before production sending."
    };
  }

  try {
    const response = await fetch(process.env.OWNER_NOTIFICATION_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id,
        sourceId: input.sourceId,
        kind: input.kind,
        urgency: input.urgency,
        route: input.route,
        sanitizedSummary: input.sanitizedSummary,
        ownerAction: input.ownerAction,
        createdAt
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      return {
        id,
        mode: health.notificationMode,
        status: "failed",
        target: safeTarget(),
        detail: "Owner notification webhook returned a non-success status. Keep manual review active."
      };
    }

    return {
      id,
      mode: health.notificationMode,
      status: "sent",
      target: safeTarget(),
      detail: "Sent sanitized owner notification to the configured webhook."
    };
  } catch {
    return {
      id,
      mode: health.notificationMode,
      status: "failed",
      target: safeTarget(),
      detail: "Owner notification webhook failed. Keep manual review active."
    };
  }
}
