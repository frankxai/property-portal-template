import { NextResponse } from "next/server";
import { notifyOwner } from "@/lib/owner-notifications";
import { persistListingDryRun } from "@/lib/runtime-store";
import { sanitizeText } from "@/lib/sanitize";
import { listingDrafts } from "@/data/properties";
import { createListingDryRun } from "@/lib/runtime-contracts";
import type { ListingChannel } from "@/lib/types";

const channels: ListingChannel[] = [
  "own-website",
  "kleinanzeigen",
  "immoscout24",
  "immowelt",
  "airbnb",
  "booking",
  "vrbo"
];

export async function POST(request: Request) {
  const input = await request.json() as Partial<{
    propertySlug: string;
    channel: ListingChannel;
  }>;

  const propertySlug = sanitizeText(input.propertySlug, 80);
  const channel = channels.includes(input.channel as ListingChannel) ? input.channel as ListingChannel : "own-website";

  const draft = listingDrafts.find((item) => item.propertySlug === propertySlug && item.channel === channel);
  if (!draft) {
    return NextResponse.json({ error: "No listing draft exists for this property and channel" }, { status: 404 });
  }

  const result = createListingDryRun({ propertySlug, channel });
  const persistence = await persistListingDryRun({
    id: result.id,
    payload: { propertySlug, channel },
    route: result.route,
    ownerAction: result.ownerAction,
    sanitizedSummary: result.sanitizedSummary,
    auditEvent: result.auditEvent
  });
  const ownerNotification = await notifyOwner({
    sourceId: result.id,
    kind: "listing-dry-run",
    urgency: "standard",
    route: result.route,
    sanitizedSummary: result.sanitizedSummary,
    ownerAction: result.ownerAction
  });

  return NextResponse.json({
    ...result,
    persistence,
    ownerNotification,
    publicationMode: draft.publicationMode,
    missingFacts: draft.missingFacts,
    payload: {
      propertySlug,
      channel,
      headline: draft.headline,
      body: draft.body,
      status: "dry-run-only"
    }
  });
}
