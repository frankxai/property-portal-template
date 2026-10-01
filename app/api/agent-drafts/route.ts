import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { agentTeam } from "@/lib/agent-control-plane";
import { requireOwnerApiAccess } from "@/lib/auth";
import { controlPlaneFailure, requireConfiguredControlPlane } from "@/lib/control-plane-route";
import {
  agentOutputTypes,
  runAgentDraftInControlPlane,
  type AgentOutputType
} from "@/lib/mcp-control-plane";
import { notifyOwner } from "@/lib/owner-notifications";
import { sanitizeText } from "@/lib/sanitize";
import type { AgentRole } from "@/lib/types";

const roles = agentTeam.map((profile) => profile.id);

export async function POST(request: Request) {
  const denied = await requireOwnerApiAccess(request, "operations:write");
  if (denied) return denied;
  const correlationId = `draft-${randomUUID()}`;
  let input: Partial<{
    missionId: string;
    role: AgentRole;
    propertySlug: string;
    outputType: AgentOutputType;
    objective: string;
    evidenceRefs: string[];
  }>;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const missionId = sanitizeText(input.missionId, 180);
  const propertySlug = sanitizeText(input.propertySlug, 120);
  const objective = sanitizeText(input.objective, 1000);
  const role = roles.includes(input.role as AgentRole) ? input.role as AgentRole : null;
  const outputType = agentOutputTypes.includes(input.outputType as AgentOutputType)
    ? input.outputType as AgentOutputType
    : null;
  const rawEvidenceRefs = Array.isArray(input.evidenceRefs) ? input.evidenceRefs : [];
  const evidenceRefs = rawEvidenceRefs.map((ref) => sanitizeText(ref, 180)).filter(Boolean);
  if (
    !missionId || !role || !outputType || !objective || !evidenceRefs.length || evidenceRefs.length > 12 ||
    evidenceRefs.length !== rawEvidenceRefs.length || new Set(evidenceRefs).size !== evidenceRefs.length
  ) {
    return NextResponse.json({ error: "A valid mission, role, outputType, objective, and unique evidenceRefs are required." }, { status: 400 });
  }

  const unavailable = requireConfiguredControlPlane("run_agent_draft", correlationId);
  if (unavailable) return unavailable;
  try {
    const run = await runAgentDraftInControlPlane({
      missionId,
      role,
      propertySlug: propertySlug || undefined,
      outputType,
      objective,
      evidenceRefs
    });
    const ownerNotification = await notifyOwner({
      sourceId: run.id,
      kind: "agent-run",
      urgency: run.riskLevel === "high" ? "standard" : "weekly",
      route: "owner-agent-review",
      sanitizedSummary: `${run.role} prepared a ${run.riskLevel}-risk ${run.outputType} draft from ${run.evidenceSnapshot.length} approved evidence record(s).`,
      ownerAction: run.ownerAction
    });
    return NextResponse.json({
      ...run,
      correlationId,
      persistence: {
        adapter: "mcp-control-plane",
        status: "recorded",
        target: "run_agent_draft"
      },
      ownerNotification
    }, { status: 201 });
  } catch (error) {
    return controlPlaneFailure(error, "run_agent_draft", correlationId);
  }
}
