import type { AgentRun, IntegrationRecord, SetupStep, SupportPayload } from "@/lib/types";

export const setupSteps: SetupStep[] = [
  {
    id: "property-profile",
    title: "Approved property profile",
    status: "needs-owner",
    outcome: "Public-safe facts, amenities, rules, units, photos, and address policy are confirmed before launch."
  },
  {
    id: "renter-portal",
    title: "Renter portal knowledge",
    status: "ready",
    outcome: "Common questions are answered from approved articles; access secrets stay out of the repo."
  },
  {
    id: "listing-studio",
    title: "Listing draft studio",
    status: "ready",
    outcome: "Own site, Kleinanzeigen, ImmoScout24, and Immowelt drafts expose missing facts before publication."
  },
  {
    id: "runtime-storage",
    title: "Secure runtime storage",
    status: "recommended",
    outcome: "Inquiries, support tickets, documents, and approvals move from demo mode into Postgres plus object storage."
  },
  {
    id: "channel-apis",
    title: "Channel integrations",
    status: "later",
    outcome: "EstateSync or direct ImmoScout24 integration publishes only owner-approved records."
  }
];

export const integrations: IntegrationRecord[] = [
  {
    id: "estatesync",
    label: "EstateSync",
    category: "listing",
    status: "planned",
    purpose: "Distribute approved German real estate listings to major portals from one canonical record.",
    ownerValue: "Reduces duplicate entry once manual listing workflow proves reliable.",
    risk: "Must confirm contract, supported fields, pricing, portal rules, and error handling before production.",
    nextStep: "Build a dry-run adapter that maps ListingDraft to an EstateSync-ready payload without sending it."
  },
  {
    id: "immoscout24",
    label: "ImmoScout24 API",
    category: "listing",
    status: "planned",
    purpose: "Create, update, publish, and inspect listing records for ImmoScout24 where API access is approved.",
    ownerValue: "Turns owner-approved listing drafts into a controlled publishing workflow.",
    risk: "Energy certificate, required fields, OAuth, account permissions, and compliance errors must be surfaced clearly.",
    nextStep: "Create required-field checklist and sandbox mapping."
  },
  {
    id: "kleinanzeigen",
    label: "Kleinanzeigen",
    category: "listing",
    status: "manual",
    purpose: "Manual copy-paste publication or approved professional import route.",
    ownerValue: "Keeps the channel useful without relying on brittle or prohibited scraping/posting.",
    risk: "Public APIs are not assumed. Automated posting is blocked until official access is verified.",
    nextStep: "Keep manual publication checklist and collect screenshots of missing field friction."
  },
  {
    id: "resend",
    label: "Resend",
    category: "messaging",
    status: "planned",
    purpose: "Send inquiry confirmations, owner review notifications, and weekly owner digests.",
    ownerValue: "Turns portal activity into a manageable inbox without exposing private records in GitHub.",
    risk: "Email content must avoid sensitive details when sent to shared inboxes.",
    nextStep: "Wire notification templates after runtime storage exists."
  },
  {
    id: "twilio-whatsapp",
    label: "Twilio WhatsApp",
    category: "messaging",
    status: "later",
    purpose: "Optional renter messaging channel for reminders and support status.",
    ownerValue: "Meets renters where they already communicate.",
    risk: "Consent, templates, escalation timing, and message retention need explicit policy.",
    nextStep: "Pilot only for owner notifications before renter-facing messages."
  },
  {
    id: "cal-com",
    label: "Cal.com",
    category: "calendar",
    status: "planned",
    purpose: "Schedule viewings, handovers, inspections, and owner review calls.",
    ownerValue: "Removes back-and-forth from viewings and handovers.",
    risk: "Availability must not imply rental availability or acceptance.",
    nextStep: "Create viewing request flow with owner confirmation."
  },
  {
    id: "stripe-connect",
    label: "Stripe Connect",
    category: "payments",
    status: "later",
    purpose: "Platform billing and optional owner/service-provider payment flows.",
    ownerValue: "Supports SaaS billing and future managed-service marketplace economics.",
    risk: "Rent/deposit handling has legal and accounting implications; keep out of v1.",
    nextStep: "Use Stripe only for SaaS subscription billing first."
  },
  {
    id: "supabase-neon",
    label: "Supabase or Neon Postgres",
    category: "database",
    status: "planned",
    purpose: "Store inquiries, tickets, approvals, sessions, organizations, and audit events securely.",
    ownerValue: "Unlocks real self-service without putting private renter data in repos.",
    risk: "Needs RLS, retention policy, backups, and environment separation.",
    nextStep: "Apply the SQL schema in db/schema.sql to the chosen managed Postgres provider."
  }
];

export const sampleAgentRuns: AgentRun[] = [
  {
    id: "run-listing-001",
    role: "listing-ops",
    trigger: "Owner requested Kleinanzeigen and ImmoScout24 drafts for a sample unit.",
    output: "Created channel-specific drafts and surfaced missing rent, utility, deposit, address, and energy fields.",
    approvalRisk: "owner-required",
    ownerAction: "Confirm missing facts before any manual publication."
  },
  {
    id: "run-inquiry-001",
    role: "inquiry-concierge",
    trigger: "Prospective renter asked about September availability and lease terms.",
    output: "Prepared a reply that acknowledges the inquiry and routes pricing/availability to owner review.",
    approvalRisk: "owner-required",
    ownerAction: "Approve or edit reply before sending."
  },
  {
    id: "run-maintenance-001",
    role: "maintenance-triage",
    trigger: "Renter reported a water-related issue with unclear severity.",
    output: "Classified as urgent-review, requested photos/location/context, and blocked repair timing promises.",
    approvalRisk: "high",
    ownerAction: "Confirm urgency and vendor path."
  },
  {
    id: "run-compliance-001",
    role: "compliance-reviewer",
    trigger: "Agent draft mentioned applicant quality and automatic prioritization.",
    output: "Blocked the draft. Tenant selection or scoring language must remain human-led and documented.",
    approvalRisk: "owner-required",
    ownerAction: "Replace with neutral process language."
  }
];

export function classifySupport(payload: SupportPayload) {
  const text = `${payload.category} ${payload.urgency} ${payload.message}`.toLowerCase();
  const emergencyTerms = ["fire", "gas", "flood", "water leak", "break-in", "locked out", "no heat", "emergency"];
  const privateTerms = ["payment", "deposit", "iban", "passport", "id card", "lease", "contract"];
  const emergency = payload.urgency === "emergency" || emergencyTerms.some((term) => text.includes(term));
  const privateDataRisk = privateTerms.some((term) => text.includes(term));

  return {
    route: emergency ? "urgent-owner-escalation" : privateDataRisk ? "owner-private-review" : "standard-owner-review",
    ownerApprovalRequired: true,
    responsePolicy: emergency
      ? "Acknowledge receipt, tell the renter to use emergency services when safety is at risk, and notify the owner."
      : "Acknowledge receipt and collect details without promising repair timing or vendor action."
  };
}
