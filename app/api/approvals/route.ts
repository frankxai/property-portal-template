import { NextResponse } from "next/server";
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

  return NextResponse.json({
    ...approval,
    ownerApprovalRequired: true,
    auditEventId: auditEvent.id
  });
}
