import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const port = Number(process.env.AUTH_SMOKE_PORT ?? 3213);
const baseUrl = `http://127.0.0.1:${port}`;
const isWindows = process.platform === "win32";
const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const signingKey = randomBytes(32).toString("base64url");
const passcode = `owner-${randomBytes(8).toString("hex")}`;
const passcodeDigest = createHash("sha256").update(`${passcode}:${signingKey}`).digest("hex");
const automationBearer = randomBytes(24).toString("base64url");

const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    PROPERTY_OS_DEMO_AUTH: "false",
    OWNER_PORTAL_SECRET: signingKey,
    OWNER_PORTAL_PASSCODE_HASH: passcodeDigest,
    OWNER_PORTAL_API_TOKEN: automationBearer
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

async function stopServer() {
  if (server.exitCode !== null) return;
  if (isWindows && server.pid) {
    spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    server.kill("SIGTERM");
  }
  await sleep(700);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`next start exited early.\n${output}`);
    }
    try {
      const response = await fetch(baseUrl, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // Keep polling until Next is ready.
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${baseUrl}.\n${output}`);
}

async function expectStatus(path, expectedStatus, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual", cache: "no-store", ...init });
  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned ${response.status}; expected ${expectedStatus}`);
  }
  return response;
}

try {
  await waitForServer();

  await expectStatus("/properties/urban-haven-sample", 200);
  await expectStatus("/owner", 307);
  await expectStatus("/admin/agent-workbench", 307);
  await expectStatus("/api/runtime/snapshot", 401);
  await expectStatus("/api/approved-evidence", 401, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  await expectStatus("/api/agent-drafts", 401, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  await expectStatus("/api/agent-run-reviews", 401, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  await expectStatus("/api/runtime/snapshot", 200, {
    headers: { authorization: `Bearer ${automationBearer}` }
  });

  const signIn = await fetch(`${baseUrl}/api/auth/owner/sign-in`, {
    method: "POST",
    redirect: "manual",
    body: new URLSearchParams({ passcode, next: "/owner" })
  });
  if (signIn.status !== 303) {
    throw new Error(`/api/auth/owner/sign-in returned ${signIn.status}; expected 303`);
  }

  const cookie = signIn.headers.get("set-cookie");
  if (!cookie?.includes("property_os_owner_session")) {
    throw new Error("Owner sign-in did not set the owner session cookie.");
  }

  await expectStatus("/owner", 200, {
    headers: { cookie }
  });
  await expectStatus("/admin/agent-workbench", 200, {
    headers: { cookie }
  });

  console.log(`Auth boundary smoke passed at ${baseUrl}`);
} finally {
  await stopServer();
}
