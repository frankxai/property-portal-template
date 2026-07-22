import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { OwnerRole } from "@/lib/identity-policy";
import { ownerAuthStatus, type OwnerAuthMode, type OwnerAuthStatus } from "@/lib/auth-configuration";
import { ownerRoleHasCapability, type OwnerCapability } from "@/lib/owner-capabilities";

export { oidcAuthEnv, ownerAuthStatus, staticPrivatePilotAuthEnv } from "@/lib/auth-configuration";
export type { OwnerAuthMode, OwnerAuthStatus } from "@/lib/auth-configuration";

const ownerSessionCookie = "property_os_owner_session";
const sessionMaxAgeSeconds = 60 * 60 * 8;

export type OwnerAccess = {
  ok: boolean;
  role: OwnerRole | "operator";
  actorId: string | null;
  mode: OwnerAuthMode;
  status: OwnerAuthStatus;
};

const passcodeAttempts = new Map<string, { count: number; resetAt: number }>();

function secret() {
  return process.env.OWNER_PORTAL_SECRET || "";
}

function passcodeHash() {
  return process.env.OWNER_PORTAL_PASSCODE_HASH || "";
}

function notificationWorkerToken() {
  return process.env.OWNER_NOTIFICATION_WORKER_TOKEN || "";
}

function safePath(path: string | null | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return "/owner";
  }
  return path;
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

export function mutationOriginError(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return null;
  const origin = request.headers.get("origin");
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(process.env.APP_BASE_URL || request.url).origin;
  } catch {
    return "The configured application origin is invalid.";
  }
  if (!origin || origin !== expectedOrigin) return "The request origin was not approved.";
  return null;
}

export function consumePasscodeAttempt(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const existing = passcodeAttempts.get(key);
  if (!existing || existing.resetAt <= now) {
    passcodeAttempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  existing.count += 1;
  if (existing.count <= 5) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
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
    return { ok: true, role: "owner", actorId: "local-demo-owner", mode: "demo-open", status };
  }

  if (status.mode === "oidc") {
    try {
      const { getOidcAuth, oidcMembershipForUser } = await import("@/lib/oidc-auth");
      const session = await getOidcAuth().api.getSession({
        headers: await headers(),
        query: { disableCookieCache: true }
      });
      if (session?.user?.id) {
        const membership = await oidcMembershipForUser(session.user.id);
        if (membership) {
          return {
            ok: true,
            role: membership.role,
            actorId: `oidc:${membership.subject}`,
            mode: "oidc",
            status
          };
        }
      }
    } catch {
      // Authentication failures remain indistinguishable at the public boundary.
    }
  }

  const cookieStore = await cookies();
  const session = cookieStore.get(ownerSessionCookie)?.value;
  if (status.mode === "static-private-pilot" && verifyOwnerSessionValue(session)) {
    return { ok: true, role: "owner", actorId: "private-pilot-owner", mode: "static-private-pilot", status };
  }

  return { ok: false, role: "owner", actorId: null, mode: status.mode, status };
}

export async function requireOwnerAccess(nextPath = "/owner") {
  const access = await ownerAccessFromCookies();
  if (access.ok) {
    return access;
  }

  redirect(`/admin/sign-in?next=${encodeURIComponent(safePath(nextPath))}`);
}

export async function requireOwnerApiAccess(request: Request, capability: OwnerCapability) {
  const status = ownerAuthStatus();
  const originError = mutationOriginError(request);
  if (originError) {
    return NextResponse.json({ error: originError }, { status: 403 });
  }

  const access = await ownerAccessFromCookies();
  if (access.ok && ownerRoleHasCapability(access.role, capability)) {
    return null;
  }

  if (access.ok) {
    return NextResponse.json({ error: "This owner role cannot perform the requested operation." }, { status: 403 });
  }

  return NextResponse.json(
    {
      error: "Owner access required",
      auth: {
        mode: status.mode,
        configured: status.configured,
        productionSafe: status.productionSafe,
        missingEnv: status.missingEnv,
        invalidEnv: status.invalidEnv
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
