import { getOidcAuth } from "@/lib/oidc-auth";
import { ownerAuthStatus } from "@/lib/auth";

async function handler(request: Request) {
  const status = ownerAuthStatus();
  if (status.mode !== "oidc" || !status.configured) {
    return Response.json({ error: "OIDC authentication is not enabled." }, { status: 404 });
  }
  return getOidcAuth().handler(request);
}

export const GET = handler;
export const POST = handler;
