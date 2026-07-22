import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import type { AgentRole } from "@/lib/types";
import { controlPlaneConfiguration } from "./mcp-configuration.ts";

const missionSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  role: z.enum([
    "property-steward",
    "listing-ops",
    "inquiry-concierge",
    "renter-guide",
    "maintenance-triage",
    "vacancy-pipeline",
    "renovation-planner",
    "compliance-reviewer",
    "visual-qa",
    "implementation-lead"
  ]),
  propertyId: z.string().nullable(),
  objective: z.string().min(1),
  successMetric: z.string().min(1),
  status: z.literal("planned"),
  authority: z.literal("draft-only"),
  stages: z.array(z.string()),
  blockedActions: z.array(z.string()),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  ownerAction: z.string().min(1)
});

export type ControlPlaneMission = z.infer<typeof missionSchema>;

export type ControlPlaneMissionInput = {
  role: AgentRole;
  propertySlug: string;
  objective: string;
  successMetric: string;
};

export async function createMissionInControlPlane(input: ControlPlaneMissionInput): Promise<ControlPlaneMission> {
  const config = controlPlaneConfiguration();
  if (!config.configured) {
    const error = new Error("MCP control plane is not fully configured.");
    Object.assign(error, { code: "MCP_NOT_CONFIGURED" });
    throw error;
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${config.accessToken}`
  };
  if (config.origin) headers.origin = config.origin;

  const transport = new StreamableHTTPClientTransport(new URL(config.url), {
    requestInit: { headers, signal: AbortSignal.timeout(config.timeoutMs) }
  });
  const client = new Client({ name: "property-portal", version: "0.2.0" });
  let connected = false;

  try {
    await client.connect(transport);
    connected = true;
    const response = await client.callTool({
      name: "create_agent_mission",
      arguments: {
        organizationId: config.organizationId,
        role: input.role,
        propertyId: input.propertySlug,
        objective: input.objective,
        successMetric: input.successMetric
      }
    });
    if (response.isError) {
      const error = new Error("MCP control plane rejected the mission.");
      Object.assign(error, { code: "MCP_TOOL_REJECTED" });
      throw error;
    }
    return missionSchema.parse(response.structuredContent);
  } catch (cause) {
    if (cause instanceof Error && "code" in cause) throw cause;
    const error = new Error("MCP control plane mission write failed.");
    Object.assign(error, { code: "MCP_UNAVAILABLE", cause });
    throw error;
  } finally {
    if (connected) await client.close().catch(() => undefined);
    else await transport.close().catch(() => undefined);
  }
}

export { controlPlaneConfiguration };
