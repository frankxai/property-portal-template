import type { AgentRole } from "@/lib/types";
import { blockedV1Actions } from "./runtime-contracts.ts";

export type AgentProfile = {
  id: AgentRole;
  label: string;
  mandate: string;
  proof: string;
};

export const agentTeam: AgentProfile[] = [
  { id: "property-steward", label: "Property Steward", mandate: "Own approved property truth and decision queues.", proof: "Schema-valid facts with approval state." },
  { id: "listing-ops", label: "Listing Ops", mandate: "Prepare channel drafts and missing-fact lists.", proof: "Owner-ready payload with no publication." },
  { id: "inquiry-concierge", label: "Inquiry Concierge", mandate: "Draft factual prospect replies.", proof: "Reply draft with commitments blocked." },
  { id: "renter-guide", label: "Renter Guide", mandate: "Improve self-service from approved knowledge.", proof: "Answer coverage and escalation route." },
  { id: "maintenance-triage", label: "Maintenance Triage", mandate: "Classify urgency and collect evidence.", proof: "Owner route without dispatch promise." },
  { id: "vacancy-pipeline", label: "Vacancy Pipeline", mandate: "Surface renewal and vacancy lead time.", proof: "Next approved acquisition action." },
  { id: "renovation-planner", label: "Renovation Planner", mandate: "Model improvement scopes and dependencies.", proof: "Options, assumptions, budget gate." },
  { id: "compliance-reviewer", label: "Compliance Reviewer", mandate: "Block privacy, selection, legal, and claim risk.", proof: "Finding, policy, correction, reviewer." },
  { id: "visual-qa", label: "Visual QA", mandate: "Verify premium property and portal experience.", proof: "Desktop/mobile evidence and score." },
  { id: "implementation-lead", label: "Implementation Lead", mandate: "Run install, production, and partner handoff gates.", proof: "Proof packet with unresolved risks." }
];

export const missionLifecycle = [
  { id: "observe", label: "Observe", detail: "Approved facts, runtime events, and missing evidence." },
  { id: "draft", label: "Draft", detail: "One bounded artifact from one specialist." },
  { id: "review", label: "Review", detail: "Privacy, compliance, quality, and factual checks." },
  { id: "decide", label: "Decide", detail: "Owner approves, rejects, changes, or stops." },
  { id: "apply", label: "Apply", detail: "Only an exact authorized internal transition." },
  { id: "verify", label: "Verify", detail: "Audit receipt, outcome metric, keep/change/stop." }
];

export const successScorecard = [
  { audience: "Owner", metric: "Weekly admin time", target: "Under 30 minutes", evidence: "Weekly review receipt" },
  { audience: "Renter", metric: "Self-service resolution", target: "70% of repeat questions", evidence: "Article and escalation analytics" },
  { audience: "Property", metric: "Vacancy readiness", target: "Draft ready 30 days before exit", evidence: "Availability timeline" },
  { audience: "Support", metric: "Urgent acknowledgement", target: "Under 5 minutes", evidence: "Notification and owner receipt" },
  { audience: "Partner", metric: "Time to first property", target: "Under 60 minutes", evidence: "Install proof packet" },
  { audience: "Platform", metric: "Unsafe autonomous actions", target: "Zero", evidence: "Blocked-action audit" }
];

export const authorityContract = {
  policyVersion: "property-os-authority.v2",
  ownerDecisionRequiredFor: ["pricing", "availability", "lease terms", "renter replies", "urgent repairs", "listing publication"],
  blockedActions: blockedV1Actions,
  controlledTransition: "proposal -> owner decision -> server receipt -> exact internal apply -> audit and undo"
};
