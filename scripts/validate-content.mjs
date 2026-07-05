import { readFile } from "node:fs/promises";
import path from "node:path";

const source = await readFile(path.join(process.cwd(), "data", "properties.ts"), "utf8");
const productSource = await readFile(path.join(process.cwd(), "lib", "product.ts"), "utf8");
const runtimeContracts = await readFile(path.join(process.cwd(), "lib", "runtime-contracts.ts"), "utf8");
await readFile(path.join(process.cwd(), "docs", "v0-implementation-brief.md"), "utf8");

const requiredSnippets = [
  "properties",
  "listingDrafts",
  "staySessions",
  "urban-haven-sample",
  "sample-stay",
  "ownerChecklist",
  "premiumSignals",
  "missingFacts",
  "publicationMode"
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`data/properties.ts is missing ${snippet}`);
  }
}

const requiredProductSnippets = [
  "setupSteps",
  "integrations",
  "sampleAgentRuns",
  "classifySupport",
  "urgent-owner-escalation",
  "owner-private-review"
];

for (const snippet of requiredProductSnippets) {
  if (!productSource.includes(snippet)) {
    throw new Error(`lib/product.ts is missing ${snippet}`);
  }
}

const requiredRuntimeSnippets = [
  "runtimeHealth",
  "blockedV1Actions",
  "createApprovalRecord",
  "createAgentRun",
  "createListingDryRun"
];

for (const snippet of requiredRuntimeSnippets) {
  if (!runtimeContracts.includes(snippet)) {
    throw new Error(`lib/runtime-contracts.ts is missing ${snippet}`);
  }
}

console.log("Portal content validation passed.");
