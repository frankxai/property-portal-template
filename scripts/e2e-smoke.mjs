import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createTestOwnerAuth, signInTestOwner } from "./test-owner-auth.mjs";

const port = Number(process.env.PORT ?? 3212);
const baseUrl = `http://127.0.0.1:${port}`;
const isWindows = process.platform === "win32";
const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const testOwner = createTestOwnerAuth(baseUrl);
let ownerCookie = "";

const routes = [
  "/",
  "/properties/urban-haven-sample",
  "/properties/urban-haven-sample/inquire",
  "/stay/sample-stay",
  "/support",
  "/admin/sign-in",
  "/owner",
  "/admin/setup",
  "/admin/implementation",
  "/admin/runtime",
  "/admin/notifications",
  "/admin/listings",
  "/admin/integrations",
  "/admin/control-center",
  "/admin/agent-workbench",
  "/admin/agent-runs",
  "/admin/ops"
];

const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), ...testOwner.env },
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
  if (server.exitCode !== null) {
    return;
  }

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
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until Next is ready.
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${baseUrl}.\n${output}`);
}

async function expectOk(path) {
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store", headers: { cookie: ownerCookie } });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
}

async function expectPageContains(path, snippets) {
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store", headers: { cookie: ownerCookie } });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  const html = await response.text();
  for (const snippet of snippets) {
    if (!html.includes(snippet)) {
      throw new Error(`${path} did not include ${snippet}`);
    }
  }
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: ownerCookie, origin: baseUrl },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.ownerApprovalRequired || !payload.sanitizedSummary) {
    throw new Error(`${path} did not return the expected owner approval payload`);
  }

  if (!payload.route || !payload.ownerAction) {
    throw new Error(`${path} did not return route and ownerAction`);
  }

  if (!payload.persistence?.status || !payload.ownerNotification?.status) {
    throw new Error(`${path} did not return persistence and owner notification receipts`);
  }

  return payload;
}

async function expectRuntimeHealth() {
  const response = await fetch(`${baseUrl}/api/runtime/health`, { cache: "no-store", headers: { cookie: ownerCookie } });
  if (!response.ok) {
    throw new Error(`/api/runtime/health returned ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.mode || !payload.blockedV1Actions?.includes("publish listing")) {
    throw new Error("/api/runtime/health did not expose runtime mode and blocked actions");
  }
}

async function expectImplementationReadiness() {
  const response = await fetch(`${baseUrl}/api/implementation/readiness`, { cache: "no-store", headers: { cookie: ownerCookie } });
  if (!response.ok) {
    throw new Error(`/api/implementation/readiness returned ${response.status}`);
  }

  const payload = await response.json();
  if (typeof payload.score !== "number" || !payload.layers?.length || !payload.partnerOffers?.length) {
    throw new Error("/api/implementation/readiness did not expose score, layers, and partner offers");
  }

  if (!payload.blockedV1Actions?.includes("publish listing")) {
    throw new Error("/api/implementation/readiness did not expose blocked v1 actions");
  }
}

async function expectInstallProofPacket() {
  const response = await fetch(`${baseUrl}/api/install/proof-packet`, { cache: "no-store", headers: { cookie: ownerCookie } });
  if (!response.ok) {
    throw new Error(`/api/install/proof-packet returned ${response.status}`);
  }

  const payload = await response.json();
  if (typeof payload.score !== "number" || !payload.installPhases?.length || !payload.commandChecks?.length) {
    throw new Error("/api/install/proof-packet did not expose score, phases, and command checks");
  }

  if (!payload.installPhases.some((phase) => phase.id === "owner-auth")) {
    throw new Error("/api/install/proof-packet did not include owner-auth phase");
  }

  if (!payload.commandChecks.some((check) => check.command === "npm run install:proof")) {
    throw new Error("/api/install/proof-packet did not include npm run install:proof command check");
  }

  if (!payload.publicSafety?.secretHandling?.includes("does not print secret values")) {
    throw new Error("/api/install/proof-packet did not include the secret redaction boundary");
  }
}

async function expectRuntimeSnapshot() {
  const response = await fetch(`${baseUrl}/api/runtime/snapshot`, { cache: "no-store", headers: { cookie: ownerCookie } });
  if (!response.ok) {
    throw new Error(`/api/runtime/snapshot returned ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.health?.adapter || !payload.counts || !payload.notificationSummary || !Array.isArray(payload.productionNotes)) {
    throw new Error("/api/runtime/snapshot did not expose health, counts, and production notes");
  }
}

async function expectGovernedWriteLocked(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: ownerCookie, origin: baseUrl },
    body: JSON.stringify(body)
  });
  if (response.status !== 503) {
    throw new Error(`${path} returned ${response.status}; expected fail-closed 503 without MCP configuration`);
  }
  const payload = await response.json();
  if (!payload.error?.includes("not configured") || !payload.correlationId) {
    throw new Error(`${path} did not return a safe fail-closed receipt`);
  }
}

try {
  await waitForServer();
  ownerCookie = await signInTestOwner(baseUrl, testOwner.passcode);

  for (const route of routes) {
    await expectOk(route);
  }

  await expectRuntimeHealth();
  await expectImplementationReadiness();
  await expectInstallProofPacket();
  await expectRuntimeSnapshot();
  await expectPageContains("/admin/setup", [
    "Install proof packet",
    "No consequential action leaves the workspace automatically.",
    "npm run install:proof"
  ]);
  await expectPageContains("/admin/control-center", [
    "One accountable team. Every action leaves proof.",
    "Approval is not execution.",
    "Unsafe actions enabled",
    "Queue mission"
  ]);
  await expectPageContains("/admin/agent-workbench", [
    "From approved fact to reviewable work.",
    "Control plane locked",
    "Approved evidence",
    "Generate governed draft",
    "No draft generated"
  ]);
  await expectPageContains("/admin/notifications", [
    "Know what reached the owner",
    "Owner acknowledgement queue",
    "No notification receipts exist yet"
  ]);
  await expectPageContains("/admin/ops", [
    "A measured operating rhythm for every property.",
    "Weekly owner review",
    "Start this week",
    "No timer is running."
  ]);

  await expectGovernedWriteLocked("/api/approved-evidence", {
    ref: "property:urban-haven-sample:profile",
    propertySlug: "urban-haven-sample",
    excerpt: "Approved sample fact.",
    sourceType: "property-profile",
    sourceVersionHash: "sample-profile-v1"
  });

  await postJson("/api/inquiries", {
    propertySlug: "urban-haven-sample",
    name: "Sample Renter",
    email: "sample@example.com",
    rentalWindow: "August to September",
    message: "I am interested in the sample property and would like owner-approved availability."
  });

  await postJson("/api/support", {
    propertySlug: "urban-haven-sample",
    category: "maintenance",
    urgency: "standard",
    message: "Sample support request for smoke testing."
  });

  const legacyRun = await fetch(`${baseUrl}/api/agent-runs`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: ownerCookie, origin: baseUrl },
    body: JSON.stringify({
      role: "listing-ops",
      trigger: "Smoke test agent run",
      output: "Drafted listing copy for owner review.",
      approvalRisk: "owner-required"
    })
  });
  if (legacyRun.status !== 503) {
    throw new Error(`/api/agent-runs returned ${legacyRun.status}; expected production fail-closed 503`);
  }

  const mission = await postJson("/api/agent-missions", {
    role: "property-steward",
    propertySlug: "urban-haven-sample",
    objective: "Prepare one owner-review artifact from approved sample facts.",
    successMetric: "One artifact with zero invented facts and an explicit owner decision."
  });
  if (mission.authority !== "draft-only" || !mission.stages?.includes("verify")) {
    throw new Error("/api/agent-missions did not return the bounded mission contract");
  }

  await postJson("/api/listing-dry-run", {
    propertySlug: "urban-haven-sample",
    channel: "immoscout24"
  });

  const approval = await fetch(`${baseUrl}/api/approvals`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: ownerCookie, origin: baseUrl },
    body: JSON.stringify({
      kind: "integration-dry-run",
      sourceId: "smoke-dry-run",
      route: "owner-listing-publication-review",
      ownerAction: "Approve dry-run payload before live publication."
    })
  });

  if (!approval.ok) {
    throw new Error(`/api/approvals returned ${approval.status}`);
  }
  const approvalPayload = await approval.json();
  if (!approvalPayload.persistence?.status || !approvalPayload.ownerNotification?.status) {
    throw new Error("/api/approvals did not return persistence and owner notification receipts");
  }

  console.log(`Smoke passed at ${baseUrl}`);
} finally {
  await stopServer();
}
