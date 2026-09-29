import { NextResponse } from "next/server";
import { requireOwnerApiAccess } from "@/lib/auth";
import { listWeeklyOwnerReviews, startWeeklyOwnerReview } from "@/lib/runtime-store";

const governedActionBoundary = [
  "send renter message",
  "publish listing",
  "change price or availability",
  "dispatch vendor",
  "make lease or legal commitment"
];

export async function GET(request: Request) {
  const denied = await requireOwnerApiAccess(request, "operations:read");
  if (denied) return denied;

  try {
    const reviews = await listWeeklyOwnerReviews(12);
    return NextResponse.json({ reviews, governedActionBoundary });
  } catch {
    return NextResponse.json(
      { error: "Weekly owner review ledger unavailable", reviews: [], governedActionBoundary },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  const denied = await requireOwnerApiAccess(request, "operations:write");
  if (denied) return denied;

  try {
    const result = await startWeeklyOwnerReview();
    return NextResponse.json({
      ...result,
      contentApplied: false,
      externalActionsPerformed: [],
      governedActionBoundary
    });
  } catch {
    return NextResponse.json(
      { error: "Weekly owner review start failed", contentApplied: false, externalActionsPerformed: [] },
      { status: 503 }
    );
  }
}
