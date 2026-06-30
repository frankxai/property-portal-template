import { NextResponse } from "next/server";
import { isSensitiveTopic, sanitizeText } from "@/lib/sanitize";
import { recordInquiry } from "@/lib/runtime";
import type { InquiryPayload } from "@/lib/types";

export async function POST(request: Request) {
  const input = await request.json() as Partial<InquiryPayload>;
  const payload: InquiryPayload = {
    propertySlug: sanitizeText(input.propertySlug, 80),
    name: sanitizeText(input.name, 120),
    email: sanitizeText(input.email, 160),
    rentalWindow: sanitizeText(input.rentalWindow, 180),
    message: sanitizeText(input.message, 1600)
  };

  if (!payload.propertySlug || !payload.name || !payload.email || !payload.message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const ownerApprovalRequired = true || isSensitiveTopic(payload.message);
  const result = await recordInquiry(payload, ownerApprovalRequired);
  return NextResponse.json(result);
}

