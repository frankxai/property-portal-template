import { NextResponse } from "next/server";
import { ownerAccessFromCookies, requireOwnerApiAccess } from "@/lib/auth";
import { RenterAccessError, revokeRenterAccessGrant } from "@/lib/renter-access";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await requireOwnerApiAccess(request, "renter-access:revoke");
  if (denied) return denied;

  const actor = await ownerAccessFromCookies();
  if (!actor.ok || !actor.actorId) {
    return NextResponse.json({ error: "Owner access required" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const revoked = await revokeRenterAccessGrant({
      id,
      actorId: actor.actorId,
      actorRole: actor.role
    });
    if (!revoked) {
      return NextResponse.json({ error: "Renter access grant not found." }, { status: 404 });
    }
    return NextResponse.json({
      id,
      status: "revoked",
      externalActionsPerformed: [],
      commitmentsCreated: []
    }, { headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    if (error instanceof RenterAccessError && error.code === "invalid-input") {
      return NextResponse.json({ error: "Invalid renter access grant id." }, { status: 400 });
    }
    return NextResponse.json({ error: "Renter access revocation is unavailable." }, { status: 503 });
  }
}
