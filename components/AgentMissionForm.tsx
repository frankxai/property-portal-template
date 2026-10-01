"use client";

import { useState } from "react";
import { agentTeam } from "@/lib/agent-control-plane";

type MissionReceipt = {
  id: string;
  role: string;
  status: string;
  authority: string;
  ownerAction: string;
  persistence: { adapter: string; status: string };
};

export function AgentMissionForm() {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [receipt, setReceipt] = useState<MissionReceipt | null>(null);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setState("submitting");
    setError("");
    setReceipt(null);
    try {
      const response = await fetch("/api/agent-missions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: formData.get("role"),
          propertySlug: formData.get("propertySlug"),
          objective: formData.get("objective"),
          successMetric: formData.get("successMetric")
        })
      });

      const body = await response.json();
      if (!response.ok) {
        setError(body.error || "Mission could not be queued.");
        setState("error");
        return;
      }
      setReceipt(body);
      setState("success");
    } catch {
      setError("Mission could not be queued. Keep the manual owner workflow active.");
      setState("error");
    }
  }

  return (
    <form action={submit} className="form-grid">
      <label className="field">
        <span>Specialist</span>
        <select name="role" defaultValue="property-steward">
          {agentTeam.map((profile) => <option value={profile.id} key={profile.id}>{profile.label}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Property slug</span>
        <input name="propertySlug" defaultValue="urban-haven-sample" required maxLength={120} />
      </label>
      <label className="field">
        <span>Mission objective</span>
        <textarea name="objective" required maxLength={800} defaultValue="Prepare the next highest-value owner-review artifact from approved facts and identify missing evidence." />
      </label>
      <label className="field">
        <span>Success metric</span>
        <input name="successMetric" required maxLength={240} defaultValue="One reviewable artifact with zero invented facts and one explicit owner decision." />
      </label>
      <button className="button" type="submit" disabled={state === "submitting"}>
        {state === "submitting" ? "Queueing mission..." : "Queue mission"}
      </button>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {receipt ? (
        <div className="mission-receipt" aria-live="polite">
          <div className="row">
            <strong>{receipt.status}</strong>
            <span className="status">{receipt.authority}</span>
          </div>
          <p className="muted">Mission {receipt.id} is recorded through {receipt.persistence.adapter}.</p>
          <p>{receipt.ownerAction}</p>
        </div>
      ) : null}
    </form>
  );
}
