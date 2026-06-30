export type ApprovalStatus = "draft" | "owner-review" | "approved" | "published";

export type AvailabilityStatus = "available" | "reserved" | "occupied" | "maintenance" | "unknown";

export type ListingChannel = "own-website" | "kleinanzeigen" | "immoscout24" | "immowelt";

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

