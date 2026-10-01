import { NextResponse } from "next/server";
import { requireNotificationWorkerAccess } from "@/lib/auth";
import { processNotificationQueue } from "@/lib/notification-worker";

export async function POST(request: Request) {
  const denied = requireNotificationWorkerAccess(request);
  if (denied) return denied;

  try {
    const result = await processNotificationQueue();
    return NextResponse.json({
      ...result,
      contentApplied: false,
      externalActionsPerformed: []
    }, { status: result.failedToRecord > 0 ? 503 : 200 });
  } catch {
    return NextResponse.json({
      error: "Notification queue unavailable",
      contentApplied: false,
      externalActionsPerformed: []
    }, { status: 503 });
  }
}
