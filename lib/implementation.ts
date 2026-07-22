import { integrations, setupSteps } from "@/lib/product";
import { ownerApprovalRequiredFor, runtimeHealth } from "@/lib/runtime-contracts";
import type { ImplementationLayer, ImplementationStatus, PartnerOffer } from "@/lib/types";

const statusWeight: Record<ImplementationStatus, number> = {
  ready: 1,
  manual: 0.72,
  configure: 0.48,
  planned: 0.28,
  blocked: 0
};

export const implementationLayers: ImplementationLayer[] = [
  {
    id: "owner-content",
    title: "Approved property knowledge",
    status: "manual",
    ownerValue: "The owner can launch with facts, policies, listing copy, and renter FAQ content that agents are allowed to reuse.",
    implementerAction: "Replace sample property content, confirm photo rights, and mark missing facts before production.",
    evidence: ["data/properties.ts", "owner checklist", "listing missing-fact fields"],
    productionGate: "Owner signs off on facts, media, public address policy, rent language, and house rules."
  },
  {
    id: "premium-web",
    title: "Premium renter and owner portal",
    status: "ready",
    ownerValue: "Renters get a calm self-service experience and owners get an operating cockpit instead of inbox chaos.",
    implementerAction: "Deploy on Vercel, set brand/property assets, verify mobile and desktop visual QA.",
    evidence: ["public property page", "stay portal", "owner dashboard", "support intake"],
    productionGate: "Vercel preview reviewed by owner; no text overlap, placeholder copy, or unapproved claims."
  },
  {
    id: "runtime-storage",
    title: "Secure runtime data layer",
    status: runtimeHealth().mode === "database-ready" ? "configure" : "planned",
    ownerValue: "Real inquiries, support tickets, approvals, and agent runs can be stored without leaking private data into GitHub.",
    implementerAction: "Apply db/schema.sql to Postgres, seed organization/property records, add auth, retention, backups, and row-level access rules.",
    evidence: ["db/schema.sql", "/api/runtime/health", "/api/runtime/snapshot", "/admin/runtime"],
    productionGate: "DATABASE_URL, auth policy, audit retention, and deletion workflow are verified in the target environment."
  },
  {
    id: "agent-swarm",
    title: "Codex, Claude, and MCP agent substrate",
    status: "manual",
    ownerValue: "Specialist agents draft listing copy, inquiry replies, maintenance summaries, and weekly reviews without making commitments.",
    implementerAction: "Pair this portal with property-os-template and configure the MCP server, agent files, and approval runbooks.",
    evidence: ["property-os-template", "MCP capability map", "agent run ledger"],
    productionGate: "Agents can only use approved facts; consequential outputs route to owner approval."
  },
  {
    id: "listing-channels",
    title: "Listing channel operations",
    status: "manual",
    ownerValue: "The owner can prepare channel-ready drafts for own website, Kleinanzeigen, ImmoScout24, and Immowelt.",
    implementerAction: "Keep publication manual in v1; evaluate EstateSync or approved portal APIs after dry-run payloads are stable.",
    evidence: ["listing draft studio", "listing dry-run API", "integration cockpit"],
    productionGate: "No automated posting unless API access, terms, required fields, and error recovery are approved."
  },
  {
    id: "notifications",
    title: "Owner notification loop",
    status: runtimeHealth().capabilities.ownerNotification ? "configure" : "planned",
    ownerValue: "Urgent issues and approval requests reach the owner without exposing sensitive details in public tools.",
    implementerAction: "Wire OWNER_NOTIFICATION_WEBHOOK_URL to email, WhatsApp, n8n, Make, or a Railway worker after storage exists.",
    evidence: ["signed primary webhook", "signed fallback webhook", "scoped worker token", "support classification", "acknowledgement receipts"],
    productionGate: "Notification templates are reviewed for privacy and do not include access secrets or private renter records."
  },
  {
    id: "business-model",
    title: "Community and partner packaging",
    status: "ready",
    ownerValue: "The same system can be sold as a premium implementation package while the community gets a safe free fork.",
    implementerAction: "Use the offer ladder, template readiness docs, and partner install runbook to sell installs and retainers.",
    evidence: ["README", "TEMPLATE_READINESS.md", "partner offers"],
    productionGate: "Paid delivery uses a private client repo and never commits real renter data to public template repositories."
  }
];

export const partnerOffers: PartnerOffer[] = [
  {
    id: "free-community",
    title: "Free community fork",
    buyer: "Solo owner or technical operator",
    priceSignal: "Free",
    includes: ["GitHub template", "Vercel deploy path", "sample property", "safety-first workflows"],
    deliveryGate: "User must replace sample data and complete production hardening before real renter data."
  },
  {
    id: "owner-install",
    title: "Done-with-you owner install",
    buyer: "Owner with 1 to 10 properties",
    priceSignal: "Setup fee plus optional monthly review retainer",
    includes: ["property content migration", "portal deployment", "listing studio", "owner training", "first weekly review"],
    deliveryGate: "Owner approval on property facts, photos, policies, and urgent escalation language."
  },
  {
    id: "agency-starter",
    title: "Agency implementation kit",
    buyer: "Real estate agency, property manager, or local AI implementer",
    priceSignal: "License, implementation fee, and support retainer",
    includes: ["private client workspace", "portal customization", "agent operating docs", "partner delivery checklist"],
    deliveryGate: "Each client install uses tenant-separated data, signed support scope, and preview approval."
  },
  {
    id: "managed-os",
    title: "Managed Property Intelligence OS",
    buyer: "Premium owner or small portfolio operator",
    priceSignal: "Monthly operations subscription",
    includes: ["weekly owner dashboard", "listing optimization", "FAQ improvement", "agent draft review", "integration roadmap"],
    deliveryGate: "Human approval remains mandatory for legal, pricing, availability, access, payment, and repair commitments."
  }
];

export function implementationReadiness() {
  const setupReady = setupSteps.filter((step) => step.status === "ready").length;
  const integrationReady = integrations.filter((integration) => integration.status === "connected" || integration.status === "manual").length;
  const weightedScore = implementationLayers.reduce((sum, layer) => sum + statusWeight[layer.status], 0);
  const score = Math.round((weightedScore / implementationLayers.length) * 100);
  const health = runtimeHealth();

  return {
    score,
    posture: score >= 75 ? "installable-with-configuration" : "template-ready",
    runtimeMode: health.mode,
    tenantModel: health.tenantModel,
    setupReady,
    setupTotal: setupSteps.length,
    integrationReady,
    integrationTotal: integrations.length,
    missingEnv: health.missingEnv,
    optionalEnv: health.optionalEnv,
    capabilities: health.capabilities,
    ownerApprovalRequiredFor,
    blockedV1Actions: health.blockedV1Actions,
    layers: implementationLayers,
    partnerOffers
  };
}
