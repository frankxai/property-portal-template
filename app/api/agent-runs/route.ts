import { NextResponse } from "next/server";
import { requireOwnerApiAccess } from "@/lib/auth";
import { notifyOwner } from "@/lib/owner-notifications";
import { persistAgentRun } from "@/lib/runtime-store";
import { sanitizeText } from "@/lib/sanitize";
import { createAgentRun } from "@/lib/runtime-contracts";
import { agentTeam } from "@/lib/agent-control-plane";
import { controlPlaneConfiguration } from "@/lib/mcp-configuration";
import type { AgentRole, ApprovalRisk } from "@/lib/types";

const roles: AgentRole[] = agentTeam.map((profile) => profile.id);

const risks: ApprovalRisk[] = ["low", "medium", "high", "owner-required"];

export async function POST(request: Request) {
  const denied = await requireOwnerApiAccess(request, "operations:write");
  if (denied) return denied;
  const controlPlane = controlPlaneConfiguration();
  if (controlPlane.configured) {
    return NextResponse.json({
      error: "The manual demo ledger is disabled when MCP is connected. Use /api/agent-drafts so evidence, model output, and owner review are governed end to end."
    }, { status: 409 });
  }
  if (controlPlane.partial || process.env.NODE_ENV === "production") {
    return NextResponse.json({
      error: "The manual demo ledger is unavailable. Configure the governed MCP control plane; no agent run was recorded."
    }, { status: 503 });
  }

  const input = await request.json() as Partial<{
    role: AgentRole;
    trigger: string;
    output: string;
    approvalRisk: ApprovalRisk;
  }>;

  const role = roles.includes(input.role as AgentRole) ? input.role as AgentRole : "property-steward";
  const approvalRisk = risks.includes(input.approvalRisk as ApprovalRisk) ? input.approvalRisk as ApprovalRisk : "owner-required";
  const trigger = sanitizeText(input.trigger, 800);
  const output = sanitizeText(input.output, 1600);

  if (!trigger || !output) {
    return NextResponse.json({ error: "Missing trigger or output" }, { status: 400 });
  }

  const payload = { role, trigger, output, approvalRisk };
  const result = createAgentRun(payload);
  const persistence = await persistAgentRun({
    id: result.id,
    payload,
    route: result.route,
    ownerAction: result.ownerAction,
    sanitizedSummary: result.sanitizedSummary,
    ownerApprovalRequired: result.ownerApprovalRequired,
    auditEvent: result.auditEvent
  });
  const ownerNotification = await notifyOwner({
    sourceId: result.id,
    kind: "agent-run",
    urgency: result.ownerApprovalRequired ? "standard" : "weekly",
    route: result.route,
    sanitizedSummary: result.sanitizedSummary,
    ownerAction: result.ownerAction
  });

  return NextResponse.json({
    ...result,
    persistence,
    ownerNotification
  });
}
