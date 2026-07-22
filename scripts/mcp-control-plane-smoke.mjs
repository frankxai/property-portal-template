import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  controlPlaneConfiguration,
  createMissionInControlPlane,
  recordAgentRunReviewInControlPlane,
  recordApprovedEvidenceInControlPlane,
  runAgentDraftInControlPlane
} from "../lib/mcp-control-plane.ts";
import { clearControlPlaneCredentialCacheForTests } from "../lib/mcp-credential.ts";

const app = createMcpExpressApp({ host: "127.0.0.1", allowedHosts: ["127.0.0.1"] });
const bearerValue = randomUUID();
const oidcClientId = "portal+smoke/client";
const credentialFixture = `${randomUUID()}:%/reserved`;
const expectedClientAuthorization = `Basic ${Buffer.from(`${encodeURIComponent(oidcClientId)}:${encodeURIComponent(credentialFixture)}`).toString("base64")}`;
const evidenceHash = "a".repeat(64);
const outputHash = "b".repeat(64);
let authorizationChecks = 0;
let credentialRequests = 0;

function result(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: value
  };
}

app.post("/mcp", async (request, response) => {
  if (request.get("authorization") !== `Bearer ${bearerValue}`) {
    response.status(401).json({ error: "unauthorized" });
    return;
  }
  authorizationChecks += 1;
  const server = new McpServer({ name: "property-os-contract-smoke", version: "0.2.0" });
  server.registerTool("create_agent_mission", {
    inputSchema: {
      organizationId: z.string(), role: z.string(), propertyId: z.string(), objective: z.string(), successMetric: z.string()
    }
  }, async (input) => result({
    id: `mission-${randomUUID()}`,
    tenantId: input.organizationId,
    role: input.role,
    propertyId: input.propertyId,
    objective: input.objective,
    successMetric: input.successMetric,
    status: "planned",
    authority: "draft-only",
    stages: ["ground", "draft", "review", "owner-decision", "verify"],
    blockedActions: ["publish_listing"],
    createdBy: "owner-smoke",
    createdAt: new Date().toISOString(),
    ownerAction: "Review before reuse."
  }));
  server.registerTool("record_approved_evidence", {
    inputSchema: {
      organizationId: z.string(), ref: z.string(), propertyId: z.string(), excerpt: z.string(), sourceType: z.string(), sourceVersionHash: z.string()
    }
  }, async (input) => result({
    ref: input.ref,
    propertyId: input.propertyId,
    sourceType: input.sourceType,
    sourceVersionHash: input.sourceVersionHash,
    contentHash: evidenceHash,
    approvalStatus: "approved",
    contentApplied: true,
    applicationScope: "internal-evidence-store-only",
    externalActionsPerformed: [],
    ownerAction: "Use the exact evidence hash for future drafts."
  }));
  server.registerTool("run_agent_draft", {
    inputSchema: {
      organizationId: z.string(), missionId: z.string(), role: z.string(), propertyId: z.string(),
      outputType: z.string(), objective: z.string(), evidenceRefs: z.array(z.string())
    }
  }, async (input) => result({
    id: `run-${randomUUID()}`,
    tenantId: input.organizationId,
    missionId: input.missionId,
    propertyId: input.propertyId,
    role: input.role,
    outputType: input.outputType,
    status: "owner-review",
    authority: "draft-only",
    modelAlias: "test/provider-model",
    promptVersion: "property-os-agent-draft.v1",
    evidenceRefs: input.evidenceRefs,
    evidenceSnapshot: [{ ref: input.evidenceRefs[0], contentHash: evidenceHash, sourceVersionHash: "sample-v1" }],
    output: {
      summary: "Grounded draft ready.",
      draft: "Approved property fact prepared for owner review.",
      evidenceRefs: input.evidenceRefs,
      missingFacts: ["Owner must confirm availability."],
      risks: ["No availability was inferred."],
      confidence: "high",
      ownerAction: "Review before reuse.",
      recommendedNextSteps: ["Compare with the approved profile."]
    },
    outputHash,
    riskLevel: "medium",
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    latencyMs: 20,
    createdBy: "owner-smoke",
    createdAt: new Date().toISOString(),
    contentApplied: false,
    externalActionsPerformed: [],
    ownerAction: "Review without sending or applying anything."
  }));
  server.registerTool("record_agent_run_review", {
    inputSchema: { organizationId: z.string(), runId: z.string(), decision: z.string(), feedback: z.string().optional() }
  }, async (input) => result({
    runId: input.runId,
    missionId: "mission-reviewed",
    decision: input.decision,
    status: "accepted",
    contentApplied: false,
    externalActionsPerformed: [],
    reviewedAt: new Date().toISOString(),
    ownerAction: "Review recorded; external work remains separate."
  }));

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  response.once("close", async () => {
    await transport.close();
    await server.close();
  });
  await transport.handleRequest(request, response, request.body);
});

app.post("/oauth/token", (request, response) => {
  if (request.get("authorization") !== expectedClientAuthorization) {
    response.status(401).json({ error: "invalid_client" });
    return;
  }
  credentialRequests += 1;
  response.json({ access_token: bearerValue, token_type: "Bearer", expires_in: 300 });
});

const listener = await new Promise((resolve, reject) => {
  const server = app.listen(0, "127.0.0.1", () => resolve(server));
  server.on("error", reject);
});
const address = listener.address();
if (!address || typeof address === "string") throw new Error("MCP smoke listener did not expose a port.");

const previous = {
  url: process.env.MCP_SERVER_URL,
  authMode: process.env.MCP_SERVER_AUTH_MODE,
  token: process.env.MCP_SERVER_ACCESS_TOKEN,
  tokenUrl: process.env.MCP_OIDC_TOKEN_URL,
  clientId: process.env.MCP_OIDC_CLIENT_ID,
  clientSecret: process.env.MCP_OIDC_CLIENT_SECRET,
  audience: process.env.MCP_OIDC_AUDIENCE,
  scope: process.env.MCP_OIDC_SCOPE,
  organizationId: process.env.PROPERTY_OS_ORG_ID
};
process.env.MCP_SERVER_URL = `http://127.0.0.1:${address.port}/mcp`;
process.env.MCP_SERVER_AUTH_MODE = "static";
process.env.MCP_SERVER_ACCESS_TOKEN = bearerValue;
process.env.PROPERTY_OS_ORG_ID = "sample-org";

try {
  if (!controlPlaneConfiguration().configured) throw new Error("Complete MCP configuration was not detected.");
  const mission = await createMissionInControlPlane({
    role: "property-steward",
    propertySlug: "sample-property",
    objective: "Verify the portal-to-control-plane contract.",
    successMetric: "One authenticated draft-only mission is returned."
  });
  if (mission.tenantId !== "sample-org" || mission.authority !== "draft-only") {
    throw new Error("MCP mission response did not preserve tenant and authority boundaries.");
  }
  const evidence = await recordApprovedEvidenceInControlPlane({
    ref: "knowledge://sample/profile",
    propertySlug: "sample-property",
    excerpt: "The apartment has two bedrooms.",
    sourceType: "property-profile",
    sourceVersionHash: "sample-v1"
  });
  if (!evidence.contentApplied || evidence.applicationScope !== "internal-evidence-store-only") {
    throw new Error("MCP evidence response crossed its internal-only boundary.");
  }
  const run = await runAgentDraftInControlPlane({
    missionId: mission.id,
    role: "property-steward",
    propertySlug: "sample-property",
    outputType: "weekly-owner-review",
    objective: "Prepare a grounded owner summary.",
    evidenceRefs: [evidence.ref]
  });
  if (run.contentApplied || run.externalActionsPerformed.length || run.evidenceSnapshot[0]?.contentHash !== evidence.contentHash) {
    throw new Error("MCP draft response did not preserve evidence and authority boundaries.");
  }
  const review = await recordAgentRunReviewInControlPlane({ runId: run.id, decision: "accept-draft", feedback: "Verified." });
  if (review.contentApplied || review.status !== "accepted") {
    throw new Error("MCP review response applied content or lost owner decision state.");
  }
  if (authorizationChecks < 4) throw new Error("Every control-plane operation must authenticate independently.");

  delete process.env.MCP_SERVER_ACCESS_TOKEN;
  if (!controlPlaneConfiguration().partial) throw new Error("Partial MCP configuration was not detected.");
  process.env.MCP_SERVER_ACCESS_TOKEN = "too-short";
  const weakConfig = controlPlaneConfiguration();
  if (!weakConfig.partial || !weakConfig.issues.some((issue) => issue.includes("32 characters"))) {
    throw new Error("Weak MCP access-token configuration was not rejected.");
  }

  delete process.env.MCP_SERVER_ACCESS_TOKEN;
  process.env.MCP_SERVER_AUTH_MODE = "oidc-client-credentials";
  process.env.MCP_OIDC_TOKEN_URL = `http://127.0.0.1:${address.port}/oauth/token`;
  process.env.MCP_OIDC_CLIENT_ID = oidcClientId;
  process.env["MCP_OIDC_CLIENT_SECRET"] = credentialFixture;
  process.env.MCP_OIDC_AUDIENCE = "property-os-mcp";
  process.env.MCP_OIDC_SCOPE = "property:read property:draft property:approve";
  clearControlPlaneCredentialCacheForTests();
  if (!controlPlaneConfiguration().configured) throw new Error("OIDC client-credential MCP configuration was not detected.");
  await createMissionInControlPlane({
    role: "property-steward",
    propertySlug: "sample-property",
    objective: "Prove short-lived MCP service credentials.",
    successMetric: "One cached client credential serves two authenticated calls."
  });
  await createMissionInControlPlane({
    role: "property-steward",
    propertySlug: "sample-property",
    objective: "Prove MCP credential cache reuse.",
    successMetric: "No second token request is made before expiry."
  });
  if (credentialRequests !== 1) throw new Error(`Expected one OIDC client credential request, received ${credentialRequests}.`);
  console.log("Portal MCP governed agent-loop contract passed.");
} finally {
  if (previous.url === undefined) delete process.env.MCP_SERVER_URL; else process.env.MCP_SERVER_URL = previous.url;
  if (previous.authMode === undefined) delete process.env.MCP_SERVER_AUTH_MODE; else process.env.MCP_SERVER_AUTH_MODE = previous.authMode;
  if (previous.token === undefined) delete process.env.MCP_SERVER_ACCESS_TOKEN; else process.env.MCP_SERVER_ACCESS_TOKEN = previous.token;
  if (previous.tokenUrl === undefined) delete process.env.MCP_OIDC_TOKEN_URL; else process.env.MCP_OIDC_TOKEN_URL = previous.tokenUrl;
  if (previous.clientId === undefined) delete process.env.MCP_OIDC_CLIENT_ID; else process.env.MCP_OIDC_CLIENT_ID = previous.clientId;
  if (previous.clientSecret === undefined) delete process.env.MCP_OIDC_CLIENT_SECRET; else process.env.MCP_OIDC_CLIENT_SECRET = previous.clientSecret;
  if (previous.audience === undefined) delete process.env.MCP_OIDC_AUDIENCE; else process.env.MCP_OIDC_AUDIENCE = previous.audience;
  if (previous.scope === undefined) delete process.env.MCP_OIDC_SCOPE; else process.env.MCP_OIDC_SCOPE = previous.scope;
  if (previous.organizationId === undefined) delete process.env.PROPERTY_OS_ORG_ID; else process.env.PROPERTY_OS_ORG_ID = previous.organizationId;
  await new Promise((resolve) => listener.close(resolve));
}
