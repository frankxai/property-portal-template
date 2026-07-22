import { NextResponse } from "next/server";
import { requireOwnerApiAccess } from "@/lib/auth";
import { agentTeam } from "@/lib/agent-control-plane";
import { notifyOwner } from "@/lib/owner-notifications";
import { createAgentMission, createAuditEvent } from "@/lib/runtime-contracts";
import { persistAgentMission } from "@/lib/runtime-store";
import { sanitizeText } from "@/lib/sanitize";
import type { AgentRole } from "@/lib/types";

const roles = agentTeam.map((profile) => profile.id);

export async function POST(request: Request) {
  const denied = await requireOwnerApiAccess(request);
  if (denied) return denied;

  const input = await request.json() as Partial<{
    role: AgentRole;
    propertySlug: string;
    objective: string;
    successMetric: string;
  }>;
  const role = roles.includes(input.role as AgentRole) ? input.role as AgentRole : "property-steward";
  const propertySlug = sanitizeText(input.propertySlug, 120);
  const objective = sanitizeText(input.objective, 800);
  const successMetric = sanitizeText(input.successMetric, 240);
  if (!propertySlug || !objective || !successMetric) {
    return NextResponse.json({ error: "Property slug, objective, and successMetric are required." }, { status: 400 });
  }

  const mission = createAgentMission({ role, propertySlug, objective, successMetric });
  const auditEvent = createAuditEvent({
    type: "agent_mission.created",
    actorRole: "owner",
    summary: `${role} mission created against ${successMetric.slice(0, 100)}`
  });
  const persistence = await persistAgentMission({ mission, auditEvent });
  if (persistence.status === "failed") {
    return NextResponse.json({
      error: "Mission was not recorded. No owner notification or downstream work was started.",
      persistence
    }, { status: 503 });
  }
  const sanitizedSummary = `${role} mission planned against ${successMetric}.`;
  const ownerNotification = await notifyOwner({
    sourceId: mission.id,
    kind: "agent-mission",
    urgency: "weekly",
    route: "owner-mission-review",
    sanitizedSummary,
    ownerAction: mission.ownerAction
  });

  return NextResponse.json({
    ...mission,
    route: "owner-mission-review",
    sanitizedSummary,
    ownerApprovalRequired: true,
    auditEventId: auditEvent.id,
    persistence,
    ownerNotification
  }, { status: 201 });
}
