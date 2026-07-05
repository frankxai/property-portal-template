import { classifySupport, integrations, sampleAgentRuns, setupSteps } from "../lib/product.ts";
import { blockedV1Actions, createAgentRun, createListingDryRun, runtimeHealth } from "../lib/runtime-contracts.ts";

const urgent = classifySupport({
  propertySlug: "urban-haven-sample",
  category: "maintenance",
  urgency: "emergency",
  message: "There is a water leak and I need help now."
});

if (urgent.route !== "urgent-owner-escalation") {
  throw new Error(`Expected urgent-owner-escalation, received ${urgent.route}`);
}

const privateReview = classifySupport({
  propertySlug: "urban-haven-sample",
  category: "billing",
  urgency: "routine",
  message: "I have a question about the deposit and contract."
});

if (privateReview.route !== "owner-private-review") {
  throw new Error(`Expected owner-private-review, received ${privateReview.route}`);
}

if (!integrations.some((integration) => integration.id === "estatesync" && integration.status === "planned")) {
  throw new Error("EstateSync integration registry entry is missing.");
}

if (!setupSteps.some((step) => step.id === "runtime-storage" && step.status === "recommended")) {
  throw new Error("Runtime storage setup step is missing.");
}

if (sampleAgentRuns.some((run) => run.approvalRisk === "low" && run.ownerAction.toLowerCase().includes("publish"))) {
  throw new Error("Agent run ledger contains unsafe low-risk publication action.");
}

if (!runtimeHealth().blockedV1Actions.includes("publish listing")) {
  throw new Error("Runtime health must expose blocked publication action.");
}

const agentRun = createAgentRun({
  role: "listing-ops",
  trigger: "Prepare a listing draft for owner review.",
  output: "Drafted copy and missing fact list.",
  approvalRisk: "owner-required"
});

if (!agentRun.ownerApprovalRequired || agentRun.route !== "owner-agent-review") {
  throw new Error("Agent runs must require owner review for owner-required risk.");
}

const dryRun = createListingDryRun({
  propertySlug: "urban-haven-sample",
  channel: "immoscout24"
});

if (!dryRun.ownerApprovalRequired || !dryRun.blockedActions.includes("publish listing")) {
  throw new Error("Listing dry run must remain owner-approved and block live publication.");
}

if (!blockedV1Actions.includes("dispatch vendor")) {
  throw new Error("Blocked v1 actions must include vendor dispatch.");
}

console.log("Agent workflow dry run passed.");
