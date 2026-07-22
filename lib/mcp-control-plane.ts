import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import type { AgentRole } from "@/lib/types";
import { controlPlaneConfiguration } from "./mcp-configuration.ts";

const roles = [
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
] as const;

export const agentOutputTypes = [
  "listing-draft",
  "inquiry-reply",
  "renter-guide",
  "maintenance-triage",
  "vacancy-review",
  "renovation-plan",
  "weekly-owner-review"
] as const;

export const evidenceSourceTypes = ["property-profile", "knowledge-article", "policy", "listing-fact"] as const;
export const agentReviewDecisions = ["accept-draft", "request-revision", "reject-draft"] as const;

const missionSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  role: z.enum(roles),
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

const evidenceRecordSchema = z.object({
  ref: z.string().min(1),
  propertyId: z.string().nullable(),
  sourceType: z.enum(evidenceSourceTypes),
  sourceVersionHash: z.string().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  approvalStatus: z.literal("approved"),
  contentApplied: z.literal(true),
  applicationScope: z.literal("internal-evidence-store-only"),
  externalActionsPerformed: z.array(z.never()).max(0),
  ownerAction: z.string().min(1)
});

const generatedDraftSchema = z.object({
  summary: z.string().min(1),
  draft: z.string().min(1),
  evidenceRefs: z.array(z.string().min(1)).min(1),
  missingFacts: z.array(z.string()),
  risks: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
  ownerAction: z.string().min(1),
  recommendedNextSteps: z.array(z.string())
});

const agentRunSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  missionId: z.string().min(1),
  propertyId: z.string().nullable(),
  role: z.enum(roles),
  outputType: z.enum(agentOutputTypes),
  status: z.literal("owner-review"),
  authority: z.literal("draft-only"),
  modelAlias: z.string().min(1),
  promptVersion: z.string().min(1),
  evidenceRefs: z.array(z.string().min(1)).min(1),
  evidenceSnapshot: z.array(z.object({
    ref: z.string().min(1),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    sourceVersionHash: z.string().min(1)
  })).min(1),
  output: generatedDraftSchema,
  outputHash: z.string().regex(/^[a-f0-9]{64}$/),
  riskLevel: z.enum(["low", "medium", "high"]),
  usage: z.object({
    inputTokens: z.number().nullable(),
    outputTokens: z.number().nullable(),
    totalTokens: z.number().nullable()
  }),
  latencyMs: z.number().nonnegative(),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  contentApplied: z.literal(false),
  externalActionsPerformed: z.array(z.never()).max(0),
  ownerAction: z.string().min(1)
});

const agentReviewSchema = z.object({
  runId: z.string().min(1),
  missionId: z.string().min(1),
  decision: z.enum(agentReviewDecisions),
  status: z.enum(["accepted", "revision-requested", "rejected"]),
  contentApplied: z.literal(false),
  externalActionsPerformed: z.array(z.never()).max(0),
  reviewedAt: z.string().datetime(),
  ownerAction: z.string().min(1)
});

export type ControlPlaneMission = z.infer<typeof missionSchema>;
export type ControlPlaneEvidenceRecord = z.infer<typeof evidenceRecordSchema>;
export type ControlPlaneAgentRun = z.infer<typeof agentRunSchema>;
export type ControlPlaneAgentReview = z.infer<typeof agentReviewSchema>;
export type AgentOutputType = typeof agentOutputTypes[number];
export type EvidenceSourceType = typeof evidenceSourceTypes[number];
export type AgentReviewDecision = typeof agentReviewDecisions[number];

export type ControlPlaneMissionInput = {
  role: AgentRole;
  propertySlug: string;
  objective: string;
  successMetric: string;
};

type ControlPlaneCall<T> = {
  name: string;
  arguments: Record<string, unknown>;
  schema: z.ZodType<T>;
};

async function callControlPlane<T>({ name, arguments: args, schema }: ControlPlaneCall<T>): Promise<T> {
  const config = controlPlaneConfiguration();
  if (!config.configured) {
    const error = new Error("MCP control plane is not fully configured.");
    Object.assign(error, { code: "MCP_NOT_CONFIGURED" });
    throw error;
  }

  const headers: Record<string, string> = { authorization: `Bearer ${config.accessToken}` };
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
      name,
      arguments: { organizationId: config.organizationId, ...args }
    });
    if (response.isError) {
      const error = new Error("MCP control plane rejected the operation.");
      Object.assign(error, { code: "MCP_TOOL_REJECTED" });
      throw error;
    }
    return schema.parse(response.structuredContent);
  } catch (cause) {
    if (cause instanceof Error && "code" in cause) throw cause;
    const error = new Error("MCP control plane operation failed.");
    Object.assign(error, { code: "MCP_UNAVAILABLE", cause });
    throw error;
  } finally {
    if (connected) await client.close().catch(() => undefined);
    else await transport.close().catch(() => undefined);
  }
}

export function createMissionInControlPlane(input: ControlPlaneMissionInput) {
  return callControlPlane({
    name: "create_agent_mission",
    arguments: {
      role: input.role,
      propertyId: input.propertySlug,
      objective: input.objective,
      successMetric: input.successMetric
    },
    schema: missionSchema
  });
}

export function recordApprovedEvidenceInControlPlane(input: {
  ref: string;
  propertySlug?: string;
  excerpt: string;
  sourceType: EvidenceSourceType;
  sourceVersionHash: string;
}) {
  return callControlPlane({
    name: "record_approved_evidence",
    arguments: {
      ref: input.ref,
      propertyId: input.propertySlug,
      excerpt: input.excerpt,
      sourceType: input.sourceType,
      sourceVersionHash: input.sourceVersionHash
    },
    schema: evidenceRecordSchema
  });
}

export function runAgentDraftInControlPlane(input: {
  missionId: string;
  role: AgentRole;
  propertySlug?: string;
  outputType: AgentOutputType;
  objective: string;
  evidenceRefs: string[];
}) {
  return callControlPlane({
    name: "run_agent_draft",
    arguments: {
      missionId: input.missionId,
      role: input.role,
      propertyId: input.propertySlug,
      outputType: input.outputType,
      objective: input.objective,
      evidenceRefs: input.evidenceRefs
    },
    schema: agentRunSchema
  });
}

export function recordAgentRunReviewInControlPlane(input: {
  runId: string;
  decision: AgentReviewDecision;
  feedback?: string;
}) {
  return callControlPlane({
    name: "record_agent_run_review",
    arguments: input,
    schema: agentReviewSchema
  });
}

export { controlPlaneConfiguration };
