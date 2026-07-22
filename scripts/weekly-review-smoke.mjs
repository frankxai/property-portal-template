import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const port = Number(process.env.WEEKLY_REVIEW_SMOKE_PORT ?? 3216);
const baseUrl = `http://127.0.0.1:${port}`;
const isWindows = process.platform === "win32";
const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));

const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), PROPERTY_OS_DEMO_AUTH: "true" },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

async function stopServer() {
  if (server.exitCode === null) {
    if (isWindows && server.pid) {
      spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      server.kill("SIGTERM");
    }
  }
  await sleep(700);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`next start exited early.\n${output}`);
    try {
      const response = await fetch(baseUrl, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // Keep polling until the built app is ready.
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${baseUrl}.\n${output}`);
}

async function post(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

try {
  await waitForServer();

  const firstStart = await post("/api/weekly-reviews");
  assert.equal(firstStart.status, 200);
  const started = await firstStart.json();
  assert.equal(started.changed, true);
  assert.equal(started.review.status, "in-progress");
  assert.deepEqual(started.externalActionsPerformed, []);
  assert.match(started.review.id, /^weekly-[a-zA-Z0-9-]+$/);

  const secondStart = await post("/api/weekly-reviews");
  assert.equal(secondStart.status, 200);
  const replayedStart = await secondStart.json();
  assert.equal(replayedStart.changed, false);
  assert.equal(replayedStart.review.id, started.review.id);

  const invalid = await post(`/api/weekly-reviews/${started.review.id}/complete`, {
    repeatedQuestionsTotal: 4,
    repeatedQuestionsCovered: 5,
    knownVacancyDate: null,
    listingReadyDate: null,
    keepNote: "Keep the approved renter guide.",
    changeNote: "Change the listing lead time.",
    stopNote: "Stop answering duplicated questions manually."
  });
  assert.equal(invalid.status, 400);

  const completion = await post(`/api/weekly-reviews/${started.review.id}/complete`, {
    repeatedQuestionsTotal: 10,
    repeatedQuestionsCovered: 8,
    knownVacancyDate: "2026-09-15",
    listingReadyDate: "2026-08-01",
    keepNote: "Keep the approved renter guide visible.",
    changeNote: "Change the listing copy before the next channel review.",
    stopNote: "Stop answering repeated Wi-Fi questions manually."
  });
  assert.equal(completion.status, 200);
  const completed = await completion.json();
  assert.equal(completed.changed, true);
  assert.equal(completed.review.status, "completed");
  assert.ok(completed.review.durationMinutes >= 1);
  assert.deepEqual(completed.externalActionsPerformed, []);
  assert.equal(completed.contentApplied, false);
  assert.equal(completed.review.observations.length, 5);

  const metrics = Object.fromEntries(completed.review.observations.map((item) => [item.metricId, item]));
  assert.equal(metrics["owner-review-time"].status, "met");
  assert.equal(metrics["self-service-coverage"].value, 80);
  assert.equal(metrics["self-service-coverage"].status, "met");
  assert.equal(metrics["vacancy-readiness"].value, 45);
  assert.equal(metrics["vacancy-readiness"].status, "met");
  assert.equal(metrics["urgent-acknowledgement"].status, "unmeasured");
  assert.equal(metrics["unauthorized-actions"].value, 0);
  assert.equal(metrics["unauthorized-actions"].source, "system-policy");

  const replayCompletion = await post(`/api/weekly-reviews/${started.review.id}/complete`, {
    repeatedQuestionsTotal: 1,
    repeatedQuestionsCovered: 0,
    knownVacancyDate: null,
    listingReadyDate: null,
    keepNote: "Replay must not change this.",
    changeNote: "Replay must not change this.",
    stopNote: "Replay must not change this."
  });
  assert.equal(replayCompletion.status, 200);
  const replayedCompletion = await replayCompletion.json();
  assert.equal(replayedCompletion.changed, false);
  assert.equal(replayedCompletion.review.repeatedQuestionsTotal, 10);

  const list = await fetch(`${baseUrl}/api/weekly-reviews`, { cache: "no-store" });
  assert.equal(list.status, 200);
  const ledger = await list.json();
  assert.equal(ledger.reviews.length, 1);
  assert.equal(ledger.reviews[0].id, started.review.id);
  assert.equal(ledger.reviews[0].observations.length, 5);

  console.log("Weekly review smoke passed: idempotent start/completion, five honest metrics, immutable replay, zero external actions.");
} finally {
  await stopServer();
}
