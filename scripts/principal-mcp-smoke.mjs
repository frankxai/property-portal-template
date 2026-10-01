import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const port = Number(process.env.PRINCIPAL_MCP_PORT ?? 3218);
const suppliedEndpoint = process.env.PRINCIPAL_MCP_URL;
const endpoint = new URL(suppliedEndpoint ?? `http://127.0.0.1:${port}/api/mcp`);
const fixture = {
  purchasePrice: 1_250_000, acquisitionCostPct: 10, initialCapex: 95_000,
  monthlyColdRent: 8_500, vacancyPct: 5, annualOperatingCosts: 9_000,
  annualMaintenanceReserve: 8_000, rentGrowthPct: 2, costGrowthPct: 2,
  loanAmount: 850_000, interestRatePct: 3.8, amortizationYears: 30,
  fixedRateYears: 5, refinanceRatePct: 4.5, horizonYears: 10,
  exitCapRatePct: 5, sellingCostPct: 3, discountRatePct: 8,
};
const stress = { vacancyDeltaPct: 5, refinanceRateDeltaPct: 2, capexOverrunPct: 20, exitCapRateDeltaPct: 1 };
const requestHeaders = { "content-type": "application/json", accept: "application/json, text/event-stream" };
const requestTimeout = 10_000;
let output = "";
let server;
const clients = [];
let checks = 0;

function finiteNumbers(value, path = "result") {
  if (typeof value === "number") assert.ok(Number.isFinite(value), `${path} must be finite`);
  if (Array.isArray(value)) value.forEach((item, index) => finiteNumbers(item, `${path}[${index}]`));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => finiteNumbers(item, `${path}.${key}`));
}

async function connectClient(name) {
  const client = new Client({ name, version: "1.0.0" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(endpoint, {
    fetch: (input, init = {}) => fetch(input, {
      ...init,
      signal: AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(requestTimeout)]),
    }),
  });
  clients.push(client);
  await client.connect(transport, { timeout: requestTimeout });
  assert.equal(client.getServerVersion()?.name, "property-principal-calculations");
  assert.equal(transport.sessionId, undefined, "Stateless server must not create a cross-request session");
  checks += 1;
  return client;
}

async function call(client, name, args) {
  const response = await client.callTool({ name, arguments: args }, undefined, { timeout: requestTimeout });
  assert.notEqual(response.isError, true, `${name} failed: ${JSON.stringify(response.content)}`);
  assert.ok(response.structuredContent, `${name} must return machine-readable results`);
  assert.deepEqual(JSON.parse(response.content.find((block) => block.type === "text").text), response.structuredContent);
  finiteNumbers(response);
  checks += 1;
  return response.structuredContent;
}

async function invalid(client, name, args) {
  const response = await client.callTool({ name, arguments: args }, undefined, { timeout: requestTimeout });
  assert.equal(response.isError, true, `${name} must reject invalid arguments`);
  assert.ok(!JSON.stringify(response).includes("node_modules"), "Internal paths must not be disclosed");
  checks += 1;
}

async function expectStatus(expected, init) {
  const response = await fetch(endpoint, { ...init, signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, expected, `${init.method ?? "GET"} expected ${expected}, received ${response.status}`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.text();
  assert.ok(!body.includes("node_modules"), "Internal paths must not be disclosed");
  checks += 1;
  return response;
}

try {
  if (!suppliedEndpoint) {
    const next = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
    console.log(`Starting isolated Next.js MCP test server at ${endpoint.origin}.`);
    server = spawn(process.execPath, [next, "start", "--hostname", "127.0.0.1", "-p", String(port)], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (chunk) => { output = (output + chunk.toString()).slice(-5_000); });
    server.stderr.on("data", (chunk) => { output = (output + chunk.toString()).slice(-5_000); });
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (server.exitCode !== null) throw new Error(`Next.js exited before the MCP test. Run npm run build first.\n${output}`);
      try {
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(1_000) });
        const status = response.status;
        await response.arrayBuffer();
        if (status === 405) { ready = true; break; }
      } catch { /* Wait for the built application to bind. */ }
      await delay(250);
    }
    if (!ready) throw new Error(`MCP route did not become ready. Run npm run build first.\n${output}`);
  }

  console.log("MCP endpoint ready; checking SDK initialization, tool discovery and playbooks.");
  const client = await connectClient("principal-mcp-smoke");
  const listing = await client.listTools(undefined, { timeout: requestTimeout });
  assert.deepEqual(listing.tools.map(({ name }) => name).sort(), ["get_property_review_playbook", "stress_property_portfolio", "underwrite_property"]);
  for (const tool of listing.tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.equal(tool.annotations.idempotentHint, true);
    assert.equal(tool.annotations.openWorldHint, false);
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.ok(tool.outputSchema, "Every tool must advertise a structured output schema");
  }
  checks += 1;

  for (const domain of ["acquisition", "ownership", "tenancy", "kleinanzeigen"]) {
    const playbook = await call(client, "get_property_review_playbook", { domain });
    assert.equal(playbook.domain, domain);
    assert.equal(playbook.reviewedAt, "2026-09-12");
    assert.ok(playbook.procedure.length >= 4 && playbook.requiredEvidence.length >= 4);
    assert.ok(playbook.primarySources.every(({ url }) => new URL(url).protocol === "https:"));
  }
  await invalid(client, "get_property_review_playbook", { domain: "personal-tax-advice" });
  await invalid(client, "get_property_review_playbook", { domain: "ownership", accountId: "private" });

  console.log("Checking underwriting, concurrent client isolation and portfolio scenarios.");
  const first = await call(client, "underwrite_property", fixture);
  assert.equal(first.calculationBasis, "user_supplied_assumptions");
  assert.equal(first.result.years.length, fixture.horizonYears);
  assert.equal(first.result.totalCost, 1_470_000);
  assert.equal(first.result.initialEquity, 620_000);
  assert.equal(first.result.years[0].scheduledRent, 102_000);
  assert.equal(first.result.years[0].effectiveRent, 96_900);
  assert.equal(first.result.years[0].noi, 87_900);

  const secondClient = await connectClient("principal-mcp-isolation");
  const [repeat, other] = await Promise.all([
    call(client, "underwrite_property", fixture),
    call(secondClient, "underwrite_property", { ...fixture, monthlyColdRent: 9_500, loanAmount: 0 }),
  ]);
  assert.deepEqual(repeat, first, "Calculation must be deterministic across requests");
  assert.equal(other.result.years[0].debtService, 0);
  assert.equal(other.result.years[0].coverageAfterReserve, null);
  assert.equal(other.result.years[0].scheduledRent, 114_000, "Concurrent client inputs must remain isolated");

  const scenario = await call(client, "stress_property_portfolio", {
    assets: [{ id: "asset-01", input: fixture }, { id: "asset-02", input: { ...fixture, loanAmount: 0 } }], stress,
  });
  assert.equal(scenario.assets.length, 2);
  assert.ok(scenario.portfolio.yearOneCashFlowDelta < 0);
  assert.equal(scenario.portfolio.additionalInitialEquity, fixture.initialCapex * 0.2 * 2);
  assert.ok(scenario.assets[0].downside.exitValue < scenario.assets[0].baseline.exitValue);

  const noShock = await call(client, "stress_property_portfolio", {
    assets: [{ id: "asset-01", input: fixture }],
    stress: { vacancyDeltaPct: 0, refinanceRateDeltaPct: 0, capexOverrunPct: 0, exitCapRateDeltaPct: 0 },
  });
  assert.deepEqual(noShock.assets[0].baseline, noShock.assets[0].downside);
  await call(client, "stress_property_portfolio", {
    assets: Array.from({ length: 12 }, (_, index) => ({ id: `asset-${index}`, input: fixture })), stress,
  });

  await invalid(client, "underwrite_property", { ...fixture, purchasePrice: -1 });
  await invalid(client, "underwrite_property", { ...fixture, url: "https://example.invalid" });
  await invalid(client, "underwrite_property", { purchasePrice: fixture.purchasePrice });
  await invalid(client, "underwrite_property", { ...fixture, interestRatePct: "3.8" });
  await invalid(client, "stress_property_portfolio", { assets: [], stress });
  await invalid(client, "stress_property_portfolio", {
    assets: Array.from({ length: 13 }, (_, index) => ({ id: `asset-${index}`, input: fixture })), stress,
  });
  await invalid(client, "stress_property_portfolio", { assets: [{ id: "asset", input: fixture }, { id: "asset", input: fixture }], stress });
  await invalid(client, "stress_property_portfolio", { assets: [{ id: "private address / text", input: fixture }], stress });
  await invalid(client, "stress_property_portfolio", { assets: [{ id: "asset", input: fixture }], stress: { ...stress, capexOverrunPct: 101 } });

  console.log("Checking HTTP methods, protocol errors and streamed request-size limits.");
  await expectStatus(405, { method: "GET", headers: { accept: "text/event-stream" } });
  await expectStatus(405, { method: "PUT" });
  await expectStatus(400, { method: "POST", headers: requestHeaders, body: "{" });
  await expectStatus(400, { method: "POST", headers: requestHeaders, body: "[]" });
  await expectStatus(403, { method: "POST", headers: { ...requestHeaders, origin: "https://untrusted.invalid" }, body: "{}" });
  await expectStatus(400, {
    method: "POST", headers: { ...requestHeaders, "mcp-protocol-version": "1900-01-01" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 40, method: "tools/list" }),
  });
  await expectStatus(413, { method: "POST", headers: requestHeaders, body: JSON.stringify({ padding: "x".repeat(33_000) }) });
  // No Content-Length: this checks streamed UTF-8 byte accounting rather than a header-only limit.
  const largeBytes = new TextEncoder().encode(JSON.stringify({ padding: "€".repeat(12_000) }));
  await expectStatus(413, {
    method: "POST", headers: requestHeaders, duplex: "half",
    body: new ReadableStream({ start(controller) { controller.enqueue(largeBytes.subarray(0, 16_000)); controller.enqueue(largeBytes.subarray(16_000)); controller.close(); } }),
  });
  await expectStatus(415, { method: "POST", headers: { ...requestHeaders, "content-encoding": "gzip" }, body: "{}" });
  await expectStatus(406, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: "{}" });
  await expectStatus(415, { method: "POST", headers: { ...requestHeaders, "content-type": "text/plain" }, body: "{}" });

  console.log(`Principal MCP smoke passed: ${checks} checks at ${endpoint.origin}${endpoint.pathname}. Official SDK initialize/list/call, deterministic isolation, 12-asset stress and request boundaries verified.`);
} finally {
  await Promise.allSettled(clients.map((client) => client.close()));
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(2_000)]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
}
