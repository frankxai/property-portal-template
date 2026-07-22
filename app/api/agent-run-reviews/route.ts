import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireOwnerApiAccess } from "@/lib/auth";
import { controlPlaneFailure, requireConfiguredControlPlane } from "@/lib/control-plane-route";
import {
  agentReviewDecisions,
  recordAgentRunReviewInControlPlane,
  type AgentReviewDecision
} from "@/lib/mcp-control-plane";
import { sanitizeText } from "@/lib/sanitize";

export async function POST(request: Request) {
  const denied = await requireOwnerApiAccess(request, "approvals:decide");
  if (denied) return denied;
  const correlationId = `review-${randomUUID()}`;
  let input: Partial<{ runId: string; decision: AgentReviewDecision; feedback: string }>;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const runId = sanitizeText(input.runId, 180);
  const feedback = sanitizeText(input.feedback, 600);
  const decision = agentReviewDecisions.includes(input.decision as AgentReviewDecision)
    ? input.decision as AgentReviewDecision
    : null;
  if (!runId || !decision) {
    return NextResponse.json({ error: "runId and a valid decision are required." }, { status: 400 });
  }

  const unavailable = requireConfiguredControlPlane("record_agent_run_review", correlationId);
  if (unavailable) return unavailable;
  try {
    const review = await recordAgentRunReviewInControlPlane({
      runId,
      decision,
      feedback: feedback || undefined
    });
    return NextResponse.json({
      ...review,
      correlationId,
      persistence: {
        adapter: "mcp-control-plane",
        status: "recorded",
        target: "record_agent_run_review"
      }
    });
  } catch (error) {
    return controlPlaneFailure(error, "record_agent_run_review", correlationId);
  }
}
