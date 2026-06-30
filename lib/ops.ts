export type OpsItem = {
  title: string;
  detail: string;
};

export type ReleaseGate = OpsItem & {
  status: "required" | "ready" | "manual";
};

export const operatingCadence: OpsItem[] = [
  {
    title: "Daily intake",
    detail: "Review inquiries, support items, urgent flags, and agent drafts before anything renter-facing is sent."
  },
  {
    title: "Weekly owner review",
    detail: "Update availability, listing status, support risk, missing facts, and next decisions in one 30 to 45 minute session."
  },
  {
    title: "Monthly premium review",
    detail: "Improve photos, copy, renter self-service, recurring support answers, and pricing proof."
  }
];

export const successCriteria: OpsItem[] = [
  {
    title: "Owner saves admin time",
    detail: "Common questions are answered by approved portal content and the owner only reviews decisions that matter."
  },
  {
    title: "Renter trusts the property",
    detail: "The first viewport shows the real property, the offer is clear, and uncertainty is labeled honestly."
  },
  {
    title: "Listings are channel-ready",
    detail: "Own website, Kleinanzeigen, ImmoScout24, and Immowelt drafts include missing facts and owner checklists."
  },
  {
    title: "Private data stays private",
    detail: "Runtime submissions stay out of public repos and GitHub receives only sanitized summaries."
  }
];

export const releaseGates: ReleaseGate[] = [
  {
    title: "Schema validation",
    detail: "Property, listing, stay, support, and FAQ records validate before release.",
    status: "required"
  },
  {
    title: "Privacy scan",
    detail: "No access secrets, renter data, payment data, or private owner facts appear in template artifacts.",
    status: "required"
  },
  {
    title: "Visual QA",
    detail: "Desktop and mobile pages have no text overlap, no generic SaaS first read, and no fake premium imagery.",
    status: "manual"
  },
  {
    title: "Owner approval",
    detail: "Pricing, availability, leases, urgent repair commitments, and publication remain human-approved.",
    status: "required"
  },
  {
    title: "Vercel preview",
    detail: "Use a preview deployment for owner review before production when connected to Vercel.",
    status: "manual"
  }
];

export const tastePrinciples: OpsItem[] = [
  {
    title: "Property first",
    detail: "The property, unit status, and practical renter value are visible before abstract product language."
  },
  {
    title: "Calm operations",
    detail: "Owner views prioritize decisions, queues, approvals, and missing facts over decorative analytics."
  },
  {
    title: "Premium by proof",
    detail: "Use real photography, verified amenities, clear house guidance, and fast support paths instead of inflated claims."
  }
];
