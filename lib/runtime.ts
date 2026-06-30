import type { InquiryPayload, SupportPayload } from "@/lib/types";

export type RuntimeResult = {
  id: string;
  mode: "demo";
  ownerApprovalRequired: boolean;
  sanitizedSummary: string;
};

export async function recordInquiry(payload: InquiryPayload, ownerApprovalRequired: boolean): Promise<RuntimeResult> {
  const id = `inq-${Date.now()}`;
  return {
    id,
    mode: "demo",
    ownerApprovalRequired,
    sanitizedSummary: `Inquiry for ${payload.propertySlug}: ${payload.rentalWindow}`
  };
}

export async function recordSupport(payload: SupportPayload, ownerApprovalRequired: boolean): Promise<RuntimeResult> {
  const id = `sup-${Date.now()}`;
  return {
    id,
    mode: "demo",
    ownerApprovalRequired,
    sanitizedSummary: `${payload.urgency} ${payload.category} support item for ${payload.propertySlug}`
  };
}

