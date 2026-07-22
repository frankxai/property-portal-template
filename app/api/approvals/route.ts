import { NextResponse } from "next/server";
import { requireOwnerApiAccess } from "@/lib/auth";
import { notifyOwner } from "@/lib/owner-notifications";
import { persistApproval } from "@/lib/runtime-store";
import { sanitizeText } from "@/lib/sanitize";
import { createApprovalRecord, createAuditEvent } from "@/lib/runtime-contracts";
import type { ApprovalKind } from "@/lib/runtime-contracts";

const allowedKinds: ApprovalKind[] = [
  "inquiry-reply",
  "support-triage",
  "listing-publication",
  "agent-output",
  "integration-dry-run"
];

export async function POST(request: Request) {
  const denied = await requireOwnerApiAccess(request, "operations:write");
  if (denied) return denied;

  const input = await request.json() as Partial<{
    kind: ApprovalKind;
    sourceId: string;
    route: string;
    ownerAction: string;
  }>;

  const kind = allowedKinds.includes(input.kind as ApprovalKind) ? input.kind as ApprovalKind : "agent-output";
  const sourceId = sanitizeText(input.sourceId, 100);
  const route = sanitizeText(input.route, 100) || "owner-review";
  const ownerAction = sanitizeText(input.ownerAction, 400);

  if (!sourceId || !ownerAction) {
    return NextResponse.json({ error: "Missing sourceId or ownerAction" }, { status: 400 });
  }

  const approval = createApprovalRecord({ kind, sourceId, route, ownerAction });
  const auditEvent = createAuditEvent({
    type: "approval.requested",
    actorRole: "agent",
    summary: `${kind} approval requested for ${sourceId}`
  });
  const persistence = await persistApproval({ approval, auditEvent });
  const ownerNotification = await notifyOwner({
    sourceId: approval.id,
    kind: "approval",
    urgency: "standard",
    route,
    sanitizedSummary: `${kind} approval requested for ${sourceId}.`,
    ownerAction
  });

  return NextResponse.json({
    ...approval,
    ownerApprovalRequired: true,
    auditEventId: auditEvent.id,
    persistence,
    ownerNotification
  });
}
