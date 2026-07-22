export type ApprovalStatus = "draft" | "owner-review" | "approved" | "published";

export type AvailabilityStatus = "available" | "reserved" | "occupied" | "maintenance" | "unknown";

export type ListingChannel =
  | "own-website"
  | "kleinanzeigen"
  | "immoscout24"
  | "immowelt"
  | "airbnb"
  | "booking"
  | "vrbo";

export type IntegrationStatus = "manual" | "planned" | "connected" | "blocked" | "later";

export type ApprovalRisk = "low" | "medium" | "high" | "owner-required";

export type AgentRole =
  | "property-steward"
  | "listing-ops"
  | "inquiry-concierge"
  | "renter-guide"
  | "maintenance-triage"
  | "vacancy-pipeline"
  | "renovation-planner"
  | "compliance-reviewer"
  | "visual-qa"
  | "implementation-lead";

export type PropertyProfile = {
  id: string;
  slug: string;
  name: string;
  status: ApprovalStatus;
  location: {
    city: string;
    country: string;
    publicArea: string;
  };
  shortDescription: string;
  longDescription: string;
  imageUrl: string;
  imageCredit: string;
  amenities: string[];
  rules: string[];
  neighborhood: string[];
  ownerChecklist: string[];
  premiumSignals: string[];
  units: Unit[];
  faq: KnowledgeArticle[];
};

export type Unit = {
  id: string;
  name: string;
  status: AvailabilityStatus;
  bedrooms: number;
  maxOccupancy: number;
  monthlyRentPublic: number | null;
  availabilityNote: string;
};

export type KnowledgeArticle = {
  id: string;
  title: string;
  answer: string;
  approvalStatus: ApprovalStatus;
};

export type ListingDraft = {
  id: string;
  propertySlug: string;
  channel: ListingChannel;
  status: ApprovalStatus;
  headline: string;
  body: string;
  ownerChecklist: string[];
  missingFacts: string[];
  publicationMode: "manual-copy" | "api-planned" | "api-connected";
};

export type StaySession = {
  accessCode: string;
  propertySlug: string;
  label: string;
  status: ApprovalStatus;
  sections: KnowledgeArticle[];
};

export type InquiryPayload = {
  propertySlug: string;
  name: string;
  email: string;
  rentalWindow: string;
  message: string;
};

export type SupportPayload = {
  propertySlug: string;
  category: string;
  urgency: string;
  message: string;
};

export type IntegrationRecord = {
  id: string;
  label: string;
  category: "listing" | "messaging" | "calendar" | "payments" | "documents" | "database" | "agent";
  status: IntegrationStatus;
  purpose: string;
  ownerValue: string;
  risk: string;
  nextStep: string;
};

export type AgentRun = {
  id: string;
  role: AgentRole;
  trigger: string;
  output: string;
  approvalRisk: ApprovalRisk;
  ownerAction: string;
};

export type SetupStep = {
  id: string;
  title: string;
  status: "ready" | "needs-owner" | "recommended" | "later";
  outcome: string;
};

export type ImplementationStatus = "ready" | "manual" | "configure" | "planned" | "blocked";

export type ImplementationLayer = {
  id: string;
  title: string;
  status: ImplementationStatus;
  ownerValue: string;
  implementerAction: string;
  evidence: string[];
  productionGate: string;
};

export type PartnerOffer = {
  id: string;
  title: string;
  buyer: string;
  priceSignal: string;
  includes: string[];
  deliveryGate: string;
};
