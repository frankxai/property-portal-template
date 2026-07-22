import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { controlPlaneConfiguration, createMissionInControlPlane } from "../lib/mcp-control-plane.ts";

const app = createMcpExpressApp({ host: "127.0.0.1", allowedHosts: ["127.0.0.1"] });
const bearerValue = randomUUID();
app.post("/mcp", async (request, response) => {
  if (request.get("authorization") !== `Bearer ${bearerValue}`) {
    response.status(401).json({ error: "unauthorized" });
    return;
  }
  const server = new McpServer({ name: "property-os-contract-smoke", version: "0.2.0" });
  server.registerTool("create_agent_mission", {
    inputSchema: {
      organizationId: z.string(),
      role: z.string(),
      propertyId: z.string(),
      objective: z.string(),
      successMetric: z.string()
    }
  }, async (input) => {
    const mission = {
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
    };
    return {
      content: [{ type: "text", text: JSON.stringify(mission) }],
      structuredContent: mission
    };
  });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  response.once("close", async () => {
    await transport.close();
    await server.close();
  });
  await transport.handleRequest(request, response, request.body);
});

const listener = await new Promise((resolve, reject) => {
  const server = app.listen(0, "127.0.0.1", () => resolve(server));
  server.on("error", reject);
});
const address = listener.address();
if (!address || typeof address === "string") throw new Error("MCP smoke listener did not expose a port.");

const previous = {
  url: process.env.MCP_SERVER_URL,
  token: process.env.MCP_SERVER_ACCESS_TOKEN,
  organizationId: process.env.PROPERTY_OS_ORG_ID
};
process.env.MCP_SERVER_URL = `http://127.0.0.1:${address.port}/mcp`;
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

  delete process.env.MCP_SERVER_ACCESS_TOKEN;
  if (!controlPlaneConfiguration().partial) throw new Error("Partial MCP configuration was not detected.");
  process.env.MCP_SERVER_ACCESS_TOKEN = "too-short";
  const weakConfig = controlPlaneConfiguration();
  if (!weakConfig.partial || !weakConfig.issues.some((issue) => issue.includes("24 characters"))) {
    throw new Error("Weak MCP access-token configuration was not rejected.");
  }
  console.log("Portal MCP control-plane contract passed.");
} finally {
  if (previous.url === undefined) delete process.env.MCP_SERVER_URL; else process.env.MCP_SERVER_URL = previous.url;
  if (previous.token === undefined) delete process.env.MCP_SERVER_ACCESS_TOKEN; else process.env.MCP_SERVER_ACCESS_TOKEN = previous.token;
  if (previous.organizationId === undefined) delete process.env.PROPERTY_OS_ORG_ID; else process.env.PROPERTY_OS_ORG_ID = previous.organizationId;
  await new Promise((resolve) => listener.close(resolve));
}
