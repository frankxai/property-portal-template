import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT ?? 3212);
const baseUrl = `http://127.0.0.1:${port}`;
const isWindows = process.platform === "win32";
const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));

const routes = [
  "/",
  "/properties/urban-haven-sample",
  "/properties/urban-haven-sample/inquire",
  "/stay/sample-stay",
  "/support",
  "/owner",
  "/admin/listings",
  "/admin/ops"
];

const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port) },
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
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.ownerApprovalRequired || !payload.sanitizedSummary) {
    throw new Error(`${path} did not return the expected owner approval payload`);
  }
}

try {
  await waitForServer();

  for (const route of routes) {
    await expectOk(route);
  }

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

  console.log(`Smoke passed at ${baseUrl}`);
} finally {
  await stopServer();
}
