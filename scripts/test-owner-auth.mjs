import { createHash, randomBytes } from "node:crypto";

export function createTestOwnerAuth(baseUrl) {
  const secret = randomBytes(32).toString("base64url");
  const passcode = `test-${randomBytes(18).toString("base64url")}`;
  const passcodeHash = createHash("sha256").update(`${passcode}:${secret}`).digest("hex");
  return {
    passcode,
    env: {
      APP_BASE_URL: baseUrl,
      PROPERTY_OS_AUTH_MODE: "static-private-pilot",
      PROPERTY_OS_DEMO_AUTH: "false",
      PROPERTY_OS_DEMO_RUNTIME: "true",
      PROPERTY_OS_LOCAL_PRODUCTION_TEST: "true",
      OWNER_PORTAL_SECRET: secret,
      OWNER_PORTAL_PASSCODE_HASH: passcodeHash
    }
  };
}

export async function signInTestOwner(baseUrl, passcode) {
  const response = await fetch(`${baseUrl}/api/auth/owner/sign-in`, {
    method: "POST",
    redirect: "manual",
    headers: { origin: baseUrl },
    body: new URLSearchParams({ passcode, next: "/owner" })
  });
  if (response.status !== 303) throw new Error(`Test owner sign-in returned ${response.status}.`);
  const setCookie = response.headers.get("set-cookie");
  const cookie = setCookie?.split(";", 1)[0];
  if (!cookie?.startsWith("property_os_owner_session=")) throw new Error("Test owner sign-in did not issue a session cookie.");
  return cookie;
}

export async function authenticateBrowserContext(context, baseUrl, passcode) {
  const cookie = await signInTestOwner(baseUrl, passcode);
  const separator = cookie.indexOf("=");
  await context.addCookies([{
    name: cookie.slice(0, separator),
    value: cookie.slice(separator + 1),
    url: baseUrl,
    httpOnly: true,
    sameSite: "Lax"
  }]);
  return cookie;
}
