import { NextResponse } from "next/server";
import { sanitizeText } from "@/lib/sanitize";
import { recordSupport } from "@/lib/runtime";
import type { SupportPayload } from "@/lib/types";

export async function POST(request: Request) {
  const input = await request.json() as Partial<SupportPayload>;
  const payload: SupportPayload = {
    propertySlug: sanitizeText(input.propertySlug, 80),
    category: sanitizeText(input.category, 80),
    urgency: sanitizeText(input.urgency, 80),
    message: sanitizeText(input.message, 1600)
  };

  if (!payload.propertySlug || !payload.category || !payload.urgency || !payload.message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const ownerApprovalRequired = true;
  try {
    const result = await recordSupport(payload, ownerApprovalRequired);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Support intake is temporarily unavailable. No request was accepted. Use the displayed urgent route when safety is at risk." },
      { status: 503 }
    );
  }
}
