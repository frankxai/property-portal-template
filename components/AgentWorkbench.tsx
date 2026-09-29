"use client";

import { useState } from "react";
import { agentTeam } from "@/lib/agent-control-plane";

type MissionReceipt = {
  id: string;
  role: string;
  propertyId?: string | null;
  propertySlug?: string | null;
  objective: string;
  successMetric: string;
  status: "planned";
  authority: "draft-only";
  ownerAction: string;
  persistence: { adapter: string; status: string; target: string };
};

type EvidenceReceipt = {
  ref: string;
  sourceType: string;
  sourceVersionHash: string;
  contentHash: string;
  approvalStatus: "approved";
  contentApplied: true;
  applicationScope: "internal-evidence-store-only";
  externalActionsPerformed: never[];
  ownerAction: string;
  persistence: { adapter: string; status: string; target: string };
};

type DraftReceipt = {
  id: string;
  missionId: string;
  role: string;
  outputType: string;
  status: "owner-review";
  authority: "draft-only";
  modelAlias: string;
  promptVersion: string;
  evidenceRefs: string[];
  evidenceSnapshot: Array<{ ref: string; contentHash: string; sourceVersionHash: string }>;
  output: {
    summary: string;
    draft: string;
    evidenceRefs: string[];
    missingFacts: string[];
    risks: string[];
    confidence: "low" | "medium" | "high";
    ownerAction: string;
    recommendedNextSteps: string[];
  };
  outputHash: string;
  riskLevel: "low" | "medium" | "high";
  usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };
  latencyMs: number;
  contentApplied: false;
  externalActionsPerformed: never[];
  ownerAction: string;
  persistence: { adapter: string; status: string; target: string };
};

type ReviewReceipt = {
  runId: string;
  missionId: string;
  decision: "accept-draft" | "request-revision" | "reject-draft";
  status: "accepted" | "revision-requested" | "rejected";
  contentApplied: false;
  externalActionsPerformed: never[];
  reviewedAt: string;
  ownerAction: string;
  persistence: { adapter: string; status: string; target: string };
};

type Stage = "mission" | "evidence" | "draft" | "review";

const outputTypes = [
  ["weekly-owner-review", "Weekly owner review"],
  ["listing-draft", "Listing draft"],
  ["inquiry-reply", "Inquiry reply"],
  ["renter-guide", "Renter guide"],
  ["maintenance-triage", "Maintenance triage"],
  ["vacancy-review", "Vacancy review"],
  ["renovation-plan", "Renovation plan"]
] as const;

const evidenceSourceTypes = [
  ["property-profile", "Property profile"],
  ["knowledge-article", "Knowledge article"],
  ["policy", "Approved policy"],
  ["listing-fact", "Listing fact"]
] as const;

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || "The governed operation could not be completed.");
  return payload;
}

function shortHash(value: string) {
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

function StageState({ done, active }: { done: boolean; active: boolean }) {
  return <span className={done ? "stage-state stage-state-done" : active ? "stage-state stage-state-active" : "stage-state"}>{done ? "Recorded" : active ? "Next" : "Locked"}</span>;
}

export function AgentWorkbench({ connected }: { connected: boolean }) {
  const [busy, setBusy] = useState<Stage | null>(null);
  const [error, setError] = useState<{ stage: Stage; message: string } | null>(null);
  const [mission, setMission] = useState<MissionReceipt | null>(null);
  const [evidence, setEvidence] = useState<EvidenceReceipt[]>([]);
  const [draft, setDraft] = useState<DraftReceipt | null>(null);
  const [review, setReview] = useState<ReviewReceipt | null>(null);

  const canWrite = connected && busy === null;
  const propertySlug = mission?.propertyId || mission?.propertySlug || "urban-haven-sample";

  async function createMission(formData: FormData) {
    setBusy("mission");
    setError(null);
    setMission(null);
    setEvidence([]);
    setDraft(null);
    setReview(null);
    try {
      const receipt = await postJson<MissionReceipt>("/api/agent-missions", {
        role: formData.get("role"),
        propertySlug: formData.get("propertySlug"),
        objective: formData.get("objective"),
        successMetric: formData.get("successMetric")
      });
      setMission(receipt);
    } catch (cause) {
      setError({ stage: "mission", message: cause instanceof Error ? cause.message : "Mission creation failed." });
    } finally {
      setBusy(null);
    }
  }

  async function recordEvidence(formData: FormData) {
    if (!mission) return;
    setBusy("evidence");
    setError(null);
    setDraft(null);
    setReview(null);
    try {
      const receipt = await postJson<EvidenceReceipt>("/api/approved-evidence", {
        ref: formData.get("ref"),
        propertySlug,
        excerpt: formData.get("excerpt"),
        sourceType: formData.get("sourceType"),
        sourceVersionHash: formData.get("sourceVersionHash")
      });
      setEvidence((current) => [...current.filter((item) => item.ref !== receipt.ref), receipt]);
    } catch (cause) {
      setError({ stage: "evidence", message: cause instanceof Error ? cause.message : "Evidence recording failed." });
    } finally {
      setBusy(null);
    }
  }

  async function generateDraft(formData: FormData) {
    if (!mission || !evidence.length) return;
    setBusy("draft");
    setError(null);
    setDraft(null);
    setReview(null);
    try {
      const receipt = await postJson<DraftReceipt>("/api/agent-drafts", {
        missionId: mission.id,
        role: mission.role,
        propertySlug,
        outputType: formData.get("outputType"),
        objective: mission.objective,
        evidenceRefs: evidence.map((item) => item.ref)
      });
      setDraft(receipt);
    } catch (cause) {
      setError({ stage: "draft", message: cause instanceof Error ? cause.message : "Draft generation failed." });
    } finally {
      setBusy(null);
    }
  }

  async function recordReview(formData: FormData) {
    if (!draft) return;
    setBusy("review");
    setError(null);
    try {
      const receipt = await postJson<ReviewReceipt>("/api/agent-run-reviews", {
        runId: draft.id,
        decision: formData.get("decision"),
        feedback: formData.get("feedback")
      });
      setReview(receipt);
    } catch (cause) {
      setError({ stage: "review", message: cause instanceof Error ? cause.message : "Review recording failed." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="workbench">
      <ol className="workbench-stage-rail" aria-label="Governed agent workflow">
        <li><span>01</span><strong>Mission</strong><StageState done={Boolean(mission)} active={!mission} /></li>
        <li><span>02</span><strong>Evidence</strong><StageState done={evidence.length > 0} active={Boolean(mission) && !evidence.length} /></li>
        <li><span>03</span><strong>Draft</strong><StageState done={Boolean(draft)} active={evidence.length > 0 && !draft} /></li>
        <li><span>04</span><strong>Review</strong><StageState done={Boolean(review)} active={Boolean(draft) && !review} /></li>
      </ol>

      {!connected ? (
        <p className="workbench-disconnected" role="status">
          Connect the Railway MCP endpoint, access token, and tenant ID to unlock writes. This page has no local agent fallback.
        </p>
      ) : null}

      <div className="workbench-grid">
        <div className="workbench-input-lane">
          <section className="workbench-panel stack">
            <div className="row workbench-panel-heading">
              <div><span className="eyebrow">01 / Scope</span><h2>Mission</h2></div>
              <span className="status">draft-only</span>
            </div>
            <form action={createMission} className="form-grid">
              <label className="field">
                <span>Specialist</span>
                <select name="role" defaultValue="property-steward">
                  {agentTeam.map((profile) => <option value={profile.id} key={profile.id}>{profile.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Property scope</span>
                <input name="propertySlug" defaultValue="urban-haven-sample" required maxLength={120} />
              </label>
              <label className="field">
                <span>Objective</span>
                <textarea name="objective" required maxLength={800} defaultValue="Prepare the next highest-value owner-review artifact from approved facts and identify missing evidence." />
              </label>
              <label className="field">
                <span>Success metric</span>
                <textarea className="compact-textarea" name="successMetric" required maxLength={240} defaultValue="One reviewable artifact with zero invented facts and one explicit owner decision." />
              </label>
              <button className="button" type="submit" disabled={!canWrite}>{busy === "mission" ? "Recording..." : mission ? "Replace mission" : "Record mission"}</button>
            </form>
            {mission ? (
              <div className="workbench-receipt" aria-live="polite">
                <div className="row"><strong>Mission recorded</strong><span className="status">{mission.status}</span></div>
                <code>{mission.id}</code>
                <p>{mission.ownerAction}</p>
                <span>{mission.persistence.adapter} / {mission.persistence.target}</span>
              </div>
            ) : null}
            {error?.stage === "mission" ? <p className="error-text" role="alert">{error.message}</p> : null}
          </section>

          <section className="workbench-panel stack" aria-disabled={!mission}>
            <div className="row workbench-panel-heading">
              <div><span className="eyebrow">02 / Ground</span><h2>Approved evidence</h2></div>
              <span className="label">{evidence.length} recorded</span>
            </div>
            <form action={recordEvidence} className="form-grid">
              <div className="workbench-field-pair">
                <label className="field"><span>Evidence reference</span><input name="ref" defaultValue="property:urban-haven-sample:profile" required maxLength={180} /></label>
                <label className="field"><span>Source version</span><input name="sourceVersionHash" defaultValue="sample-profile-v1" required maxLength={128} /></label>
              </div>
              <label className="field">
                <span>Source type</span>
                <select name="sourceType" defaultValue="property-profile">
                  {evidenceSourceTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Exact approved excerpt</span>
                <textarea name="excerpt" required maxLength={2000} defaultValue="Sample property profile: furnished urban apartment, two bedrooms, one bathroom, owner review required for availability and pricing." />
              </label>
              <button className="button-secondary" type="submit" disabled={!canWrite || !mission}>{busy === "evidence" ? "Recording..." : "Record approved evidence"}</button>
            </form>
            {evidence.map((item) => (
              <div className="evidence-receipt" key={item.ref}>
                <div className="row"><strong>{item.ref}</strong><span className="status">approved</span></div>
                <span>{item.sourceType} / {item.sourceVersionHash}</span>
                <code title={item.contentHash}>{shortHash(item.contentHash)}</code>
              </div>
            ))}
            {error?.stage === "evidence" ? <p className="error-text" role="alert">{error.message}</p> : null}
          </section>
        </div>

        <section className="workbench-output stack" aria-disabled={!evidence.length}>
          <div className="row workbench-panel-heading">
            <div><span className="eyebrow">03 / Produce</span><h2>Structured draft</h2></div>
            {draft ? <span className={`status ${draft.riskLevel === "high" ? "status-danger" : draft.riskLevel === "medium" ? "status-warning" : ""}`}>{draft.riskLevel} risk</span> : <span className="label">Awaiting evidence</span>}
          </div>
          <form action={generateDraft} className="workbench-generate-row">
            <label className="field"><span>Artifact</span><select name="outputType" defaultValue="weekly-owner-review">{outputTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <button className="button" type="submit" disabled={!canWrite || !mission || !evidence.length}>{busy === "draft" ? "Generating..." : "Generate governed draft"}</button>
          </form>
          {error?.stage === "draft" ? <p className="error-text" role="alert">{error.message}</p> : null}

          {!draft ? (
            <div className="workbench-empty">
              <strong>No draft generated</strong>
              <p>The model receives only the mission and approved evidence references. It has no tools and cannot send, publish, price, promise, or dispatch.</p>
            </div>
          ) : (
            <div className="draft-result" aria-live="polite">
              <div className="draft-summary"><span className="label">Summary</span><p>{draft.output.summary}</p></div>
              <div className="draft-copy"><span className="label">Draft artifact</span><p>{draft.output.draft}</p></div>
              <div className="draft-facts-grid">
                <div><span className="label">Missing facts</span>{draft.output.missingFacts.length ? <ul>{draft.output.missingFacts.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None declared</p>}</div>
                <div><span className="label">Risks</span>{draft.output.risks.length ? <ul>{draft.output.risks.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None declared</p>}</div>
              </div>
              <div className="draft-proof">
                <div><span className="label">Model / prompt</span><strong>{draft.modelAlias} / {draft.promptVersion}</strong></div>
                <div><span className="label">Output hash</span><code title={draft.outputHash}>{shortHash(draft.outputHash)}</code></div>
                <div><span className="label">Latency</span><strong>{draft.latencyMs} ms</strong></div>
                <div><span className="label">Tokens</span><strong>{draft.usage.totalTokens ?? "not reported"}</strong></div>
              </div>
              <div className="no-action-proof">
                <strong>Nothing was applied or sent.</strong>
                <span>contentApplied: {String(draft.contentApplied)} / external actions: {draft.externalActionsPerformed.length}</span>
              </div>
            </div>
          )}

          <div className="workbench-review">
            <div><span className="eyebrow">04 / Decide</span><h2>Owner review</h2></div>
            <form action={recordReview} className="form-grid">
              <label className="field"><span>Decision note</span><textarea name="feedback" maxLength={600} placeholder="Name a correction, missing fact, or reason for the decision." /></label>
              <div className="review-actions">
                <button className="button" name="decision" value="accept-draft" type="submit" disabled={!canWrite || !draft || Boolean(review)}>Accept draft</button>
                <button className="button-secondary button-warning" name="decision" value="request-revision" type="submit" disabled={!canWrite || !draft || Boolean(review)}>Request revision</button>
                <button className="button-secondary button-danger" name="decision" value="reject-draft" type="submit" disabled={!canWrite || !draft || Boolean(review)}>Reject</button>
              </div>
            </form>
            {busy === "review" ? <p className="muted">Recording owner decision...</p> : null}
            {error?.stage === "review" ? <p className="error-text" role="alert">{error.message}</p> : null}
            {review ? (
              <div className="review-receipt" aria-live="polite">
                <div className="row"><strong>{review.status}</strong><span className="status">decision recorded</span></div>
                <p>{review.ownerAction}</p>
                <span>{new Date(review.reviewedAt).toLocaleString()} / contentApplied: {String(review.contentApplied)} / external actions: {review.externalActionsPerformed.length}</span>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
