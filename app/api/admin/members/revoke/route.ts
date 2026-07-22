import { NextResponse } from "next/server";
import { ownerAccessFromCookies, ownerAuthStatus, requireOwnerApiAccess } from "@/lib/auth";
import { revokeOidcMembership } from "@/lib/oidc-auth";
import { sanitizeText } from "@/lib/sanitize";

export async function POST(request: Request) {
  const denied = await requireOwnerApiAccess(request, "identity:revoke");
  if (denied) return denied;
  if (ownerAuthStatus().mode !== "oidc") {
    return NextResponse.json({ error: "Membership revocation is available only in OIDC mode." }, { status: 409 });
  }

  let input: { subject?: unknown };
  try {
    input = await request.json() as { subject?: unknown };
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }
  const subject = sanitizeText(input.subject, 255);
  if (!subject) return NextResponse.json({ error: "A member subject is required." }, { status: 400 });

  const actor = await ownerAccessFromCookies();
  const actorSubject = actor.ok && actor.mode === "oidc" && actor.actorId?.startsWith("oidc:")
    ? actor.actorId.slice("oidc:".length)
    : "";
  if (!actorSubject) return NextResponse.json({ error: "A current OIDC owner session is required." }, { status: 401 });

  let result: Awaited<ReturnType<typeof revokeOidcMembership>>;
  try {
    result = await revokeOidcMembership(subject, actorSubject);
  } catch {
    return NextResponse.json({ error: "Membership revocation was not authorized or could not be recorded." }, { status: 403 });
  }
  return NextResponse.json({
    ...result,
    subject,
    status: result.revoked ? "revoked" : "not-found",
    sessionRevocation: "atomic"
  }, { status: result.revoked ? 200 : 404 });
}
