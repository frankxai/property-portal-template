import { NextResponse } from "next/server";
import {
  consumePasscodeAttempt,
  createOwnerSessionValue,
  mutationOriginError,
  ownerAuthStatus,
  ownerSessionCookie,
  ownerSessionCookieOptions,
  safePath,
  verifyOwnerPasscode
} from "@/lib/auth";

export async function POST(request: Request) {
  if (ownerAuthStatus().mode !== "static-private-pilot") {
    return NextResponse.json({ error: "Passcode sign-in is not enabled." }, { status: 404 });
  }

  const originError = mutationOriginError(request);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const attempt = consumePasscodeAttempt(request);
  if (!attempt.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again later." },
      { status: 429, headers: { "retry-after": String(attempt.retryAfterSeconds) } }
    );
  }

  const formData = await request.formData();
  const passcode = String(formData.get("passcode") || "");
  const nextPath = safePath(String(formData.get("next") || "/owner"));
  const appBaseUrl = process.env.APP_BASE_URL!;

  if (!verifyOwnerPasscode(passcode)) {
    return NextResponse.redirect(new URL(`/admin/sign-in?error=invalid&next=${encodeURIComponent(nextPath)}`, appBaseUrl), 303);
  }

  const response = NextResponse.redirect(new URL(nextPath, appBaseUrl), 303);
  response.cookies.set(ownerSessionCookie, createOwnerSessionValue(), ownerSessionCookieOptions());
  return response;
}
