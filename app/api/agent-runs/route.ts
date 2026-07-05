import { NextResponse } from "next/server";
import { notifyOwner } from "@/lib/owner-notifications";
import { persistAgentRun } from "@/lib/runtime-store";
import { sanitizeText } from "@/lib/sanitize";
import { createAgentRun } from "@/lib/runtime-contracts";
import type { AgentRole, ApprovalRisk } from "@/lib/types";

const roles: AgentRole[] = [
  "property-steward",
  "listing-ops",
  "inquiry-concierge",
  "renter-guide",
  "maintenance-triage",
  "vacancy-pipeline",
  "compliance-reviewer"
];

const risks: ApprovalRisk[] = ["low", "medium", "high", "owner-required"];

export async function POST(request: Request) {
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
