import { NextResponse } from "next/server";
import { createOwnerSessionValue, ownerSessionCookie, ownerSessionCookieOptions, safePath, verifyOwnerPasscode } from "@/lib/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const passcode = String(formData.get("passcode") || "");
  const nextPath = safePath(String(formData.get("next") || "/owner"));

  if (!verifyOwnerPasscode(passcode)) {
    return NextResponse.redirect(new URL(`/admin/sign-in?error=invalid&next=${encodeURIComponent(nextPath)}`, request.url), 303);
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), 303);
  response.cookies.set(ownerSessionCookie, createOwnerSessionValue(), ownerSessionCookieOptions());
  return response;
}
