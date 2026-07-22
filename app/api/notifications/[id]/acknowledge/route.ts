import { NextResponse } from "next/server";
import { requireOwnerApiAccess } from "@/lib/auth";
import { acknowledgeNotificationDelivery } from "@/lib/runtime-store";
import { sanitizeText } from "@/lib/sanitize";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await requireOwnerApiAccess(request);
  if (denied) return denied;

  const { id: rawId } = await context.params;
  const id = sanitizeText(rawId, 100);
  if (!/^notif-[a-zA-Z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
  }

  const result = await acknowledgeNotificationDelivery(id, "owner-portal");
  if (!result.delivery) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json({
    delivery: result.delivery,
    changed: result.changed,
    contentApplied: false,
    externalActionsPerformed: []
  });
}
