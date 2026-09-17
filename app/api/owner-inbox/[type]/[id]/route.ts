import { NextResponse } from "next/server";
import { ownerAccessFromCookies, requireOwnerApiAccess } from "@/lib/auth";
import {
  getOwnerInboxDetail,
  ownerInboxActionBoundary,
  ownerInboxExternalActionReceipt,
  OwnerInboxError,
  parseOwnerInboxMutation,
  updateOwnerInboxItem,
  validOwnerInboxId,
  validOwnerInboxSource,
  type OwnerInboxSourceType
} from "@/lib/owner-inbox";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const privateHeaders = { "cache-control": "private, no-store, max-age=0" };

function errorResponse(error: unknown) {
  const code = error instanceof OwnerInboxError ? error.code : "database-unavailable";
  const status = code === "invalid-input" ? 400
    : code === "not-found" ? 404
      : code === "forbidden" ? 403
        : code === "stale" ? 409
          : 503;
  const message = code === "not-found" ? "Inbox item not found."
    : code === "forbidden" ? "This owner role cannot perform the requested inbox operation."
      : code === "stale" ? "This inbox item changed. Refresh it before saving again."
        : code === "invalid-input" ? "The inbox update is invalid."
          : "Owner inbox storage is unavailable.";
  return NextResponse.json({ error: message, ...ownerInboxExternalActionReceipt }, { status, headers: privateHeaders });
}

async function routeIdentity(context: { params: Promise<{ type: string; id: string }> }) {
  const params = await context.params;
  if (!validOwnerInboxSource(params.type) || !validOwnerInboxId(params.id)) throw new OwnerInboxError("invalid-input");
  return { type: params.type as OwnerInboxSourceType, id: params.id };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ type: string; id: string }> }
) {
  const denied = await requireOwnerApiAccess(request, "owner-inbox:read");
  if (denied) {
    denied.headers.set("cache-control", privateHeaders["cache-control"]);
    return denied;
  }
  try {
    const identity = await routeIdentity(context);
    const result = await getOwnerInboxDetail(identity.type, identity.id);
    if (!result) throw new OwnerInboxError("not-found");
    return NextResponse.json({
      ...result,
      actionBoundary: ownerInboxActionBoundary,
      ...ownerInboxExternalActionReceipt
    }, { headers: privateHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ type: string; id: string }> }
) {
  const denied = await requireOwnerApiAccess(request, "owner-inbox:write");
  if (denied) {
    denied.headers.set("cache-control", privateHeaders["cache-control"]);
    return denied;
  }
  try {
    const [identity, actor] = await Promise.all([routeIdentity(context), ownerAccessFromCookies()]);
    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      throw new OwnerInboxError("invalid-input");
    }
    if (!actor.ok || !actor.actorId || actor.role === "operator") throw new OwnerInboxError("forbidden");
    const result = await updateOwnerInboxItem({
      ...identity,
      actorId: actor.actorId,
      actorRole: actor.role,
      mutation: parseOwnerInboxMutation(body)
    });
    return NextResponse.json({
      ...result,
      actionBoundary: ownerInboxActionBoundary,
      ...ownerInboxExternalActionReceipt
    }, { headers: privateHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
