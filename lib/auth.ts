import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

const ownerSessionCookie = "property_os_owner_session";
const sessionMaxAgeSeconds = 60 * 60 * 8;

export type OwnerAuthMode = "passcode" | "demo-open" | "locked";

export type OwnerAuthStatus = {
  mode: OwnerAuthMode;
  configured: boolean;
  productionSafe: boolean;
  missingEnv: string[];
  detail: string;
};

export type OwnerAccess = {
  ok: boolean;
  role: "owner" | "operator";
  mode: OwnerAuthMode | "api-token";
  status: OwnerAuthStatus;
};

function secret() {
  return process.env.OWNER_PORTAL_SECRET || "";
}

function passcodeHash() {
  return process.env.OWNER_PORTAL_PASSCODE_HASH || "";
}

function apiToken() {
  return process.env.OWNER_PORTAL_API_TOKEN || "";
}

function notificationWorkerToken() {
  return process.env.OWNER_NOTIFICATION_WORKER_TOKEN || "";
}

function demoAuthAllowed() {
  return process.env.PROPERTY_OS_DEMO_AUTH === "true" || (process.env.NODE_ENV !== "production" && !secret() && !passcodeHash());
}

function safePath(path: string | null | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return "/owner";
  }
  return path;
}

export function ownerAuthStatus(): OwnerAuthStatus {
  const missingEnv = [
    !secret() ? "OWNER_PORTAL_SECRET" : "",
    !passcodeHash() ? "OWNER_PORTAL_PASSCODE_HASH" : ""
  ].filter(Boolean);

  if (!missingEnv.length) {
    return {
      mode: "passcode",
      configured: true,
      productionSafe: true,
      missingEnv,
      detail: "Owner passcode auth is configured. Browser sessions use signed, HttpOnly cookies."
    };
  }

  if (demoAuthAllowed()) {
    return {
      mode: "demo-open",
      configured: false,
      productionSafe: false,
      missingEnv,
      detail: "Demo owner access is open for local smoke tests. Do not use this mode with real renter data."
    };
  }

  return {
    mode: "locked",
    configured: false,
    productionSafe: false,
    missingEnv,
    detail: "Owner/admin access is locked until OWNER_PORTAL_SECRET and OWNER_PORTAL_PASSCODE_HASH are configured."
  };
}

export function createPasscodeHash(passcode: string, signingSecret = secret()) {
  return createHash("sha256").update(`${passcode}:${signingSecret}`).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyOwnerPasscode(passcode: string) {
  if (!secret() || !passcodeHash() || !passcode) {
    return false;
  }

  return safeEqual(createPasscodeHash(passcode), passcodeHash());
}

function signSession(expiresAt: number) {
  return createHmac("sha256", secret()).update(`owner.${expiresAt}`).digest("base64url");
}

export function createOwnerSessionValue() {
  if (!secret()) {
    throw new Error("OWNER_PORTAL_SECRET is required before creating an owner session.");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds;
  return `${expiresAt}.${signSession(expiresAt)}`;
}

function verifyOwnerSessionValue(value: string | undefined) {
  if (!secret() || !value) {
    return false;
  }

  const [expiresAtRaw, signature] = value.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!expiresAt || !signature || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }

  return safeEqual(signSession(expiresAt), signature);
}

export async function ownerAccessFromCookies(): Promise<OwnerAccess> {
  const status = ownerAuthStatus();
  if (status.mode === "demo-open") {
    return { ok: true, role: "owner", mode: "demo-open", status };
  }

  const cookieStore = await cookies();
  const session = cookieStore.get(ownerSessionCookie)?.value;
  if (status.mode === "passcode" && verifyOwnerSessionValue(session)) {
    return { ok: true, role: "owner", mode: "passcode", status };
  }

  return { ok: false, role: "owner", mode: status.mode, status };
}

export async function requireOwnerAccess(nextPath = "/owner") {
  const access = await ownerAccessFromCookies();
  if (access.ok) {
    return access;
  }

  redirect(`/admin/sign-in?next=${encodeURIComponent(safePath(nextPath))}`);
}

export async function requireOwnerApiAccess(request: Request) {
  const status = ownerAuthStatus();
  const authHeader = request.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

  if (apiToken() && safeEqual(bearer, apiToken())) {
    return null;
  }

  const access = await ownerAccessFromCookies();
  if (access.ok) {
    return null;
  }

  return NextResponse.json(
    {
      error: "Owner access required",
      auth: {
        mode: status.mode,
        configured: status.configured,
        productionSafe: status.productionSafe,
        missingEnv: status.missingEnv
      }
    },
    { status: status.mode === "locked" ? 503 : 401 }
  );
}

export function requireNotificationWorkerAccess(request: Request) {
  const workerCredential = notificationWorkerToken();
  if (!workerCredential) {
    return NextResponse.json(
      { error: "Notification worker is not configured", missingEnv: ["OWNER_NOTIFICATION_WORKER_TOKEN"] },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!bearer || !safeEqual(bearer, workerCredential)) {
    return NextResponse.json({ error: "Notification worker access required" }, { status: 401 });
  }
  return null;
}

export function ownerSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: sessionMaxAgeSeconds
  };
}

export function clearOwnerSessionCookie(response: NextResponse) {
  response.cookies.set(ownerSessionCookie, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export function randomOwnerSecret() {
  return randomBytes(32).toString("base64url");
}

export { ownerSessionCookie, safePath };
