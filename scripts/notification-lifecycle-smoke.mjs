import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createTestOwnerAuth, signInTestOwner } from "./test-owner-auth.mjs";

const port = Number(process.env.NOTIFICATION_SMOKE_PORT ?? 3215);
const baseUrl = `http://127.0.0.1:${port}`;
const isWindows = process.platform === "win32";
const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const testOwner = createTestOwnerAuth(baseUrl);
let ownerCookie = "";
const workerToken = randomBytes(32).toString("base64url");
const primarySigningSecret = randomBytes(32).toString("base64url");
const fallbackSigningSecret = randomBytes(32).toString("base64url");
const privateSentinel = "PRIVATE_DETAIL_SHOULD_NOT_LEAVE";
const primaryRequests = [];
const fallbackRequests = [];
let failNextPrimary = false;

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Mock webhook did not bind to a TCP port");
  return `http://127.0.0.1:${address.port}`;
}

async function captureRequest(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return {
    headers: request.headers,
    body: Buffer.concat(chunks).toString("utf8")
  };
}

const primaryServer = createServer(async (request, response) => {
  primaryRequests.push(await captureRequest(request));
  if (failNextPrimary) {
    failNextPrimary = false;
    response.writeHead(503).end();
    return;
  }
  response.writeHead(202).end();
});

const fallbackServer = createServer(async (request, response) => {
  fallbackRequests.push(await captureRequest(request));
  response.writeHead(202).end();
});

const primaryUrl = await listen(primaryServer);
const fallbackUrl = await listen(fallbackServer);

const nextServer = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    ...testOwner.env,
    OWNER_NOTIFICATION_WEBHOOK_URL: primaryUrl,
    OWNER_NOTIFICATION_WEBHOOK_SIGNING_SECRET: primarySigningSecret,
    OWNER_NOTIFICATION_FALLBACK_WEBHOOK_URL: fallbackUrl,
    OWNER_NOTIFICATION_FALLBACK_SIGNING_SECRET: fallbackSigningSecret,
    OWNER_NOTIFICATION_WORKER_TOKEN: workerToken,
    OWNER_NOTIFICATION_ACK_TIMEOUT_MS: "1000",
    OWNER_NOTIFICATION_RETRY_BASE_MS: "1000",
    OWNER_NOTIFICATION_CLAIM_LEASE_MS: "5000",
    OWNER_NOTIFICATION_REQUEST_TIMEOUT_MS: "2000"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
nextServer.stdout.on("data", (chunk) => { output += chunk.toString(); });
nextServer.stderr.on("data", (chunk) => { output += chunk.toString(); });

async function stop() {
  primaryServer.close();
  fallbackServer.close();
  if (nextServer.exitCode === null) {
    if (isWindows && nextServer.pid) {
      spawn("taskkill", ["/pid", String(nextServer.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      nextServer.kill("SIGTERM");
    }
  }
  await sleep(700);
}

async function waitForNext() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (nextServer.exitCode !== null) throw new Error(`next start exited early.\n${output}`);
    try {
      const response = await fetch(baseUrl, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // Keep polling until the built app is ready.
    }
    await sleep(400);
  }
  throw new Error(`Timed out waiting for ${baseUrl}.\n${output}`);
}

async function processQueue(token = workerToken) {
  const response = await fetch(`${baseUrl}/api/notifications/process`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` }
  });
  return { response, payload: await response.json() };
}

async function deliveries() {
  const response = await fetch(`${baseUrl}/api/notifications`, { cache: "no-store", headers: { cookie: ownerCookie } });
  assert.equal(response.status, 200);
  return (await response.json()).deliveries;
}

async function submitSupport(urgency, message) {
  const response = await fetch(`${baseUrl}/api/support`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      propertySlug: "urban-haven-sample",
      category: "maintenance",
      urgency,
      message
    })
  });
  assert.equal(response.status, 200);
  return response.json();
}

function verifySignedRequest(request, signingSecret) {
  const timestamp = request.headers["x-property-os-timestamp"];
  const signature = request.headers["x-property-os-signature"];
  assert.ok(timestamp);
  const expected = createHmac("sha256", signingSecret).update(`${timestamp}.${request.body}`).digest("hex");
  assert.equal(signature, `v1=${expected}`);
  assert.equal(request.headers["x-property-os-event"], "owner.notification");
  assert.doesNotMatch(request.body, new RegExp(privateSentinel));
  const payload = JSON.parse(request.body);
  assert.equal(payload.contentApplied, false);
  assert.deepEqual(payload.externalActionsPerformed, []);
  assert.match(payload.payloadHash, /^[a-f0-9]{64}$/);
  return payload;
}

try {
  await waitForNext();
  ownerCookie = await signInTestOwner(baseUrl, testOwner.passcode);

  const denied = await processQueue("wrong-worker-token");
  assert.equal(denied.response.status, 401);

  const urgent = await submitSupport("emergency", privateSentinel);
  assert.equal(urgent.route, "urgent-owner-escalation");
  assert.equal(urgent.ownerNotification.status, "queued");
  assert.equal(urgent.ownerNotification.deliveryAttempted, false);
  assert.match(urgent.ownerNotification.payloadHash, /^[a-f0-9]{64}$/);

  const primaryRun = await processQueue();
  assert.equal(primaryRun.response.status, 200);
  assert.equal(primaryRun.payload.claimed, 1);
  assert.deepEqual(primaryRun.payload.externalActionsPerformed, []);
  assert.equal(primaryRequests.length, 1);
  const primaryPayload = verifySignedRequest(primaryRequests[0], primarySigningSecret);
  assert.equal(primaryPayload.id, urgent.ownerNotification.id);
  assert.equal(primaryPayload.acknowledgementRequired, true);
  assert.match(primaryPayload.acknowledgementUrl, /\/admin\/notifications\?notification=/);

  let records = await deliveries();
  let urgentDelivery = records.find((item) => item.id === urgent.ownerNotification.id);
  assert.equal(urgentDelivery.status, "sent");
  assert.equal(urgentDelivery.primaryAttemptCount, 1);

  await sleep(1100);
  const fallbackRun = await processQueue();
  assert.equal(fallbackRun.payload.claimed, 1);
  assert.equal(fallbackRequests.length, 1);
  const fallbackPayload = verifySignedRequest(fallbackRequests[0], fallbackSigningSecret);
  assert.equal(fallbackPayload.id, urgent.ownerNotification.id);

  records = await deliveries();
  urgentDelivery = records.find((item) => item.id === urgent.ownerNotification.id);
  assert.equal(urgentDelivery.status, "fallback-sent");
  assert.equal(urgentDelivery.fallbackAttemptCount, 1);

  const acknowledge = await fetch(`${baseUrl}/api/notifications/${urgent.ownerNotification.id}/acknowledge`, {
    method: "POST",
    headers: { cookie: ownerCookie, origin: baseUrl }
  });
  assert.equal(acknowledge.status, 200);
  const acknowledgement = await acknowledge.json();
  assert.equal(acknowledgement.changed, true);
  assert.equal(acknowledgement.delivery.status, "acknowledged");
  assert.deepEqual(acknowledgement.externalActionsPerformed, []);

  const replay = await fetch(`${baseUrl}/api/notifications/${urgent.ownerNotification.id}/acknowledge`, {
    method: "POST",
    headers: { cookie: ownerCookie, origin: baseUrl }
  });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).changed, false);

  failNextPrimary = true;
  const standard = await submitSupport("standard", "A sample standard maintenance request.");
  const failedRun = await processQueue();
  assert.equal(failedRun.payload.claimed, 1);
  records = await deliveries();
  let standardDelivery = records.find((item) => item.id === standard.ownerNotification.id);
  assert.equal(standardDelivery.status, "failed");
  assert.equal(standardDelivery.primaryAttemptCount, 1);
  assert.equal(standardDelivery.lastErrorCode, "http-503");

  await sleep(1100);
  const retryRun = await processQueue();
  assert.equal(retryRun.payload.claimed, 1);
  records = await deliveries();
  standardDelivery = records.find((item) => item.id === standard.ownerNotification.id);
  assert.equal(standardDelivery.status, "sent");
  assert.equal(standardDelivery.primaryAttemptCount, 2);

  const emptyRun = await processQueue();
  assert.equal(emptyRun.payload.claimed, 0);
  console.log("Notification lifecycle smoke passed: signed outbox, retry, urgent fallback, idempotent acknowledgement, zero downstream actions.");
} finally {
  await stop();
}
