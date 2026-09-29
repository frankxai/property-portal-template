import { NextResponse } from "next/server";
import { ownerAccessFromCookies, requireOwnerApiAccess } from "@/lib/auth";
import { createRenterAccessGrant, RenterAccessError } from "@/lib/renter-access";

export async function POST(request: Request) {
  const denied = await requireOwnerApiAccess(request, "renter-access:create");
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const actor = await ownerAccessFromCookies();
  if (!actor.ok || !actor.actorId) {
    return NextResponse.json({ error: "Owner access required" }, { status: 401 });
  }
  try {
    const result = await createRenterAccessGrant({
      propertyId: typeof body.propertyId === "string" ? body.propertyId : "",
      unitId: typeof body.unitId === "string" ? body.unitId : null,
      rentalLabel: typeof body.rentalLabel === "string" ? body.rentalLabel : null,
      expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : "",
      actorId: actor.actorId,
      actorRole: actor.role
    });
    return NextResponse.json({
      grant: result.grant,
      accessCode: result.accessCode,
      plaintextCodeReturnedOnce: true,
      externalActionsPerformed: [],
      commitmentsCreated: []
    }, {
      status: 201,
      headers: { "cache-control": "no-store, private" }
    });
  } catch (error) {
    if (error instanceof RenterAccessError && error.code === "invalid-input") {
      return NextResponse.json({ error: "A valid property, expiry, and optional unit or rental label are required." }, { status: 400 });
    }
    if (error instanceof RenterAccessError && error.code === "not-found") {
      return NextResponse.json({ error: "The property or unit is not available for renter access." }, { status: 404 });
    }
    return NextResponse.json({ error: "Renter access storage is unavailable. No grant was created." }, { status: 503 });
  }
}
