import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireOwnerApiAccess } from "@/lib/auth";
import { controlPlaneFailure, requireConfiguredControlPlane } from "@/lib/control-plane-route";
import {
  evidenceSourceTypes,
  recordApprovedEvidenceInControlPlane,
  type EvidenceSourceType
} from "@/lib/mcp-control-plane";
import { sanitizeText } from "@/lib/sanitize";

export async function POST(request: Request) {
  const denied = await requireOwnerApiAccess(request);
  if (denied) return denied;
  const correlationId = `evidence-${randomUUID()}`;
  let input: Partial<{
    ref: string;
    propertySlug: string;
    excerpt: string;
    sourceType: EvidenceSourceType;
    sourceVersionHash: string;
  }>;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const ref = sanitizeText(input.ref, 180);
  const propertySlug = sanitizeText(input.propertySlug, 120);
  const excerpt = sanitizeText(input.excerpt, 2000);
  const sourceVersionHash = sanitizeText(input.sourceVersionHash, 128);
  const sourceType = evidenceSourceTypes.includes(input.sourceType as EvidenceSourceType)
    ? input.sourceType as EvidenceSourceType
    : null;
  if (!ref || !excerpt || !sourceType || !sourceVersionHash) {
    return NextResponse.json({ error: "ref, excerpt, sourceType, and sourceVersionHash are required." }, { status: 400 });
  }

  const unavailable = requireConfiguredControlPlane("record_approved_evidence", correlationId);
  if (unavailable) return unavailable;
  try {
    const evidence = await recordApprovedEvidenceInControlPlane({
      ref,
      propertySlug: propertySlug || undefined,
      excerpt,
      sourceType,
      sourceVersionHash
    });
    return NextResponse.json({
      ...evidence,
      correlationId,
      persistence: {
        adapter: "mcp-control-plane",
        status: "recorded",
        target: "record_approved_evidence"
      }
    }, { status: 201 });
  } catch (error) {
    return controlPlaneFailure(error, "record_approved_evidence", correlationId);
  }
}
