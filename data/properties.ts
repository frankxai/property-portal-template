import type { ListingDraft, PropertyProfile, StaySession } from "@/lib/types";

export const properties: PropertyProfile[] = [
  {
    id: "urban-haven-sample",
    slug: "urban-haven-sample",
    name: "Urban Haven Sample",
    status: "approved",
    location: {
      city: "Seesen",
      country: "Germany",
      publicArea: "Harz region sample"
    },
    shortDescription: "A public-safe sample property for the renter portal template.",
    longDescription:
      "A calm, well-presented rental home example with approved facts, a clear inquiry path, and renter self-service knowledge. Replace this sample with owner-approved property details before publication.",
    imageUrl:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
    imageCredit: "Unsplash sample property image. Replace with owned or approved property photography before production.",
    amenities: ["Bright living area", "Kitchen basics", "Work-ready table", "Good transit access", "Quiet residential setting"],
    rules: ["Quiet hours follow house rules", "Smoking policy requires owner confirmation", "Pets policy requires owner confirmation"],
    neighborhood: ["Local shops within normal city reach", "Public transport access to be confirmed", "Harz region context for longer stays"],
    ownerChecklist: [
      "Replace sample photography with owned property media",
      "Confirm rent, utilities, deposit, and minimum rental period",
      "Confirm whether exact address is public or shown after qualification",
      "Approve emergency, maintenance, and access escalation paths"
    ],
    premiumSignals: [
      "Clear property facts before inquiry",
      "Renter self-service portal for repeated questions",
      "Owner-reviewed listing copy per channel",
      "No hidden automation for sensitive decisions"
    ],
    units: [
      {
        id: "sample-unit",
        name: "Sample Unit",
        status: "unknown",
        bedrooms: 1,
        maxOccupancy: 2,
        monthlyRentPublic: null,
        availabilityNote: "Availability and rent require owner approval."
      }
    ],
    faq: [
      {
        id: "approved-facts",
        title: "What information is confirmed?",
        answer:
          "Only the sample public facts on this page are approved. Exact pricing, dates, lease terms, and private address details require owner review.",
        approvalStatus: "approved"
      },
      {
        id: "maintenance",
        title: "How do renters report maintenance?",
        answer:
          "Use the support form with a short description and urgency. The owner reviews all commitments before repair timing or vendor routing is confirmed.",
        approvalStatus: "approved"
      },
      {
        id: "extensions",
        title: "Can renters ask to extend?",
        answer:
          "Yes. Extension interest is captured for owner review. The portal does not promise availability automatically.",
        approvalStatus: "approved"
      }
    ]
  }
];

export const listingDrafts: ListingDraft[] = [
  {
    id: "own-website-sample",
    propertySlug: "urban-haven-sample",
    channel: "own-website",
    status: "owner-review",
    headline: "Urban Haven Sample - calm rental home in the Harz region",
    body:
      "A public-safe sample listing for the owner website. Replace with approved property photography, verified amenities, confirmed rent, and owner-approved availability before publication.",
    ownerChecklist: ["Confirm rent", "Confirm availability", "Approve photos", "Confirm house rules", "Review exact address policy"],
    missingFacts: ["rent", "availability", "owned photography", "exact address publication policy"],
    publicationMode: "manual-copy"
  },
  {
    id: "kleinanzeigen-sample",
    propertySlug: "urban-haven-sample",
    channel: "kleinanzeigen",
    status: "owner-review",
    headline: "Helle Beispielwohnung - Angaben in Pruefung",
    body:
      "Dies ist ein Entwurf fuer Kleinanzeigen. Preis, Verfuegbarkeit, Nebenkosten, Kaution und genaue Adresse muessen vor Veroeffentlichung vom Eigentuemer freigegeben werden.",
    ownerChecklist: ["Miete bestaetigen", "Zeitraum bestaetigen", "Nebenkosten klaeren", "Kaution klaeren", "Kontaktweg bestaetigen"],
    missingFacts: ["Kaltmiete", "Nebenkosten", "Kaution", "Bezugsdatum", "Kontaktweg"],
    publicationMode: "manual-copy"
  },
  {
    id: "immoscout24-sample",
    propertySlug: "urban-haven-sample",
    channel: "immoscout24",
    status: "owner-review",
    headline: "Ruhige Beispielwohnung mit klarer Mieterinformation",
    body:
      "Ein ImmoScout24-Entwurf auf Basis freigegebener Fakten. Vor Veroeffentlichung sind Energieausweis, Preis, Adresse, Verfuegbarkeit und Vertragsdetails zu pruefen.",
    ownerChecklist: ["Energieangaben pruefen", "Mietpreis bestaetigen", "Vertragsdetails pruefen", "Fotos freigeben"],
    missingFacts: ["Energieausweis", "Mietpreis", "Wohnflaeche", "Adresse", "Vertragsdetails"],
    publicationMode: "api-planned"
  },
  {
    id: "immowelt-sample",
    propertySlug: "urban-haven-sample",
    channel: "immowelt",
    status: "owner-review",
    headline: "Beispielobjekt fuer manuelle Immowelt-Veroeffentlichung",
    body:
      "Dieser Text ist ein sicherer Entwurf. Er ersetzt keine rechtliche oder portalbezogene Pruefung und darf erst nach Eigentuemerfreigabe genutzt werden.",
    ownerChecklist: ["Pflichtangaben pruefen", "Bilder freigeben", "Kontakt und Besichtigung klaeren"],
    missingFacts: ["Pflichtangaben", "Bilderrechte", "Besichtigungstermine", "Kontaktweg"],
    publicationMode: "api-planned"
  }
];

export const staySessions: StaySession[] = [
  {
    accessCode: "sample-stay",
    propertySlug: "urban-haven-sample",
    label: "Sample renter portal",
    status: "approved",
    sections: [
      {
        id: "arrival",
        title: "Arrival basics",
        answer:
          "Arrival and access details are confirmed by the owner through the approved private channel. This sample portal does not expose access secrets.",
        approvalStatus: "approved"
      },
      {
        id: "house-info",
        title: "House information",
        answer:
          "Use this area for approved house rules, recycling, utilities, and local guidance. Keep codes, passwords, and renter-specific details out of repository content.",
        approvalStatus: "approved"
      },
      {
        id: "urgent",
        title: "Urgent issues",
        answer:
          "Urgent or emergency issues should follow the owner-approved escalation path. The portal can collect context, but a human must confirm commitments.",
        approvalStatus: "approved"
      }
    ]
  }
];

export function getProperty(slug: string) {
  return properties.find((property) => property.slug === slug);
}

export function getStaySession(accessCode: string) {
  return staySessions.find((session) => session.accessCode === accessCode);
}
