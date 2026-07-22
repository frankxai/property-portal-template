import { NextResponse } from "next/server";
import { requireOwnerApiAccess } from "@/lib/auth";
import { listNotificationDeliveries } from "@/lib/runtime-store";

export async function GET(request: Request) {
  const denied = await requireOwnerApiAccess(request);
  if (denied) return denied;

  try {
    const deliveries = await listNotificationDeliveries(50);
    return NextResponse.json({
      deliveries,
      blockedExternalActions: ["send renter message", "dispatch vendor", "disclose access secret"]
    });
  } catch {
    return NextResponse.json({
      error: "Notification delivery ledger unavailable",
      deliveries: [],
      blockedExternalActions: ["send renter message", "dispatch vendor", "disclose access secret"]
    }, { status: 503 });
  }
}
