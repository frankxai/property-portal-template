import { NextResponse } from "next/server";
import { requireOwnerApiAccess } from "@/lib/auth";
import {
  listOwnerInbox,
  ownerInboxActionBoundary,
  ownerInboxExternalActionReceipt,
  ownerInboxSourceTypes,
  ownerInboxStatuses,
  OwnerInboxError,
  type OwnerInboxDueState,
  type OwnerInboxFilters,
  type OwnerInboxSourceType,
  type OwnerInboxStatus
} from "@/lib/owner-inbox";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const privateHeaders = { "cache-control": "private, no-store, max-age=0" };

function filtersFromRequest(request: Request): OwnerInboxFilters {
  const search = new URL(request.url).searchParams;
  const type = search.get("type");
  const status = search.get("status");
  const urgency = search.get("urgency");
  const due = search.get("due");
  if (type && !ownerInboxSourceTypes.includes(type as OwnerInboxSourceType)) throw new OwnerInboxError("invalid-input");
  if (status && !ownerInboxStatuses.includes(status as OwnerInboxStatus)) throw new OwnerInboxError("invalid-input");
  if (urgency && !["standard", "urgent"].includes(urgency)) throw new OwnerInboxError("invalid-input");
  if (due && !["none", "scheduled", "due-soon", "overdue", "complete"].includes(due)) throw new OwnerInboxError("invalid-input");
  return {
    type: type as OwnerInboxSourceType | undefined,
    status: status as OwnerInboxStatus | undefined,
    urgency: urgency as "standard" | "urgent" | undefined,
    due: due as OwnerInboxDueState | undefined
  };
}

export async function GET(request: Request) {
  const denied = await requireOwnerApiAccess(request, "owner-inbox:read");
  if (denied) {
    denied.headers.set("cache-control", privateHeaders["cache-control"]);
    return denied;
  }
  try {
    const items = await listOwnerInbox(filtersFromRequest(request));
    return NextResponse.json({
      items,
      actionBoundary: ownerInboxActionBoundary,
      ...ownerInboxExternalActionReceipt
    }, { headers: privateHeaders });
  } catch (error) {
    const status = error instanceof OwnerInboxError && error.code === "invalid-input" ? 400 : 503;
    return NextResponse.json({
      error: status === 400 ? "Inbox filters are invalid." : "Owner inbox storage is unavailable.",
      items: [],
      ...ownerInboxExternalActionReceipt
    }, { status, headers: privateHeaders });
  }
}
