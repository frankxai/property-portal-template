import { NextResponse } from "next/server";
import { requireOwnerApiAccess } from "@/lib/auth";
import { agentTeam } from "@/lib/agent-control-plane";
import { notifyOwner } from "@/lib/owner-notifications";
import { controlPlaneConfiguration, createMissionInControlPlane } from "@/lib/mcp-control-plane";
import { createAgentMission, createAuditEvent } from "@/lib/runtime-contracts";
import { persistAgentMission, type RuntimePersistenceReceipt } from "@/lib/runtime-store";
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

  const localAuditEvent = createAuditEvent({
    type: "agent_mission.created",
    actorRole: "owner",
    summary: `${role} mission created against ${successMetric.slice(0, 100)}`
  });
  const controlPlane = controlPlaneConfiguration();
  if (controlPlane.partial) {
    console.error("Agent mission MCP configuration denied", {
      correlationId: localAuditEvent.id,
      issues: controlPlane.issues
    });
    return NextResponse.json({
      error: "MCP control plane configuration is incomplete. No mission was recorded or started.",
      correlationId: localAuditEvent.id
    }, { status: 503 });
  }

  let mission = createAgentMission({ role, propertySlug, objective, successMetric });
  let auditEventId = localAuditEvent.id;
  let persistence: RuntimePersistenceReceipt;

  if (controlPlane.configured) {
    try {
      const remoteMission = await createMissionInControlPlane({ role, propertySlug, objective, successMetric });
      mission = {
        id: remoteMission.id,
        role: remoteMission.role,
        propertySlug: remoteMission.propertyId,
        objective: remoteMission.objective,
        successMetric: remoteMission.successMetric,
        status: remoteMission.status,
        authority: remoteMission.authority,
        ownerApprovalRequired: true,
        stages: remoteMission.stages,
        ownerAction: remoteMission.ownerAction,
        createdAt: remoteMission.createdAt
      };
      auditEventId = `mcp:${remoteMission.id}`;
      persistence = {
        adapter: "mcp-control-plane" as const,
        status: "recorded" as const,
        target: "create_agent_mission",
        detail: "Recorded mission through the authenticated MCP control plane."
      };
    } catch (error) {
      console.error("Agent mission MCP write failed", {
        correlationId: localAuditEvent.id,
        code: error instanceof Error && "code" in error ? String(error.code) : "MCP_WRITE_FAILED"
      });
      return NextResponse.json({
        error: "The governed control plane did not record the mission. No local fallback, owner notification, or downstream work was started.",
        correlationId: localAuditEvent.id
      }, { status: 503 });
    }
  } else {
    persistence = await persistAgentMission({ mission, auditEvent: localAuditEvent });
  }

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
    auditEventId,
    persistence,
    ownerNotification
  }, { status: 201 });
}
