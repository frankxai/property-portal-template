import { NextResponse } from "next/server";
import { clearOwnerSessionCookie, mutationOriginError } from "@/lib/auth";

export async function GET(request: Request) {
  return NextResponse.json({ error: "Use POST to sign out." }, { status: 405, headers: { allow: "POST" } });
}

export async function POST(request: Request) {
  const originError = mutationOriginError(request);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });
  const response = NextResponse.redirect(new URL("/admin/sign-in", process.env.APP_BASE_URL || request.url), 303);
  clearOwnerSessionCookie(response);
  return response;
}
