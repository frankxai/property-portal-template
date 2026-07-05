"use client";

import { useState } from "react";

type State = {
  status: "idle" | "submitting" | "done" | "error";
  message: string;
};

export function SupportForm() {
  const [state, setState] = useState<State>({ status: "idle", message: "" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting", message: "Preparing support triage." });
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertySlug: formData.get("propertySlug"),
        category: formData.get("category"),
        urgency: formData.get("urgency"),
        message: formData.get("message")
      })
    });

    if (!response.ok) {
      setState({ status: "error", message: "The support item could not be prepared. Please try again." });
      return;
    }

    const result = await response.json() as { id: string; ownerApprovalRequired: boolean; route: string; ownerAction: string };
    setState({
      status: "done",
      message: `Support item ${result.id} is routed to ${result.route}. ${result.ownerAction}`
    });
    event.currentTarget.reset();
  }

  return (
    <form className="form-card form-grid" onSubmit={submit}>
      <label className="field">
        <span>Property</span>
        <select name="propertySlug" defaultValue="urban-haven-sample">
          <option value="urban-haven-sample">Urban Haven Sample</option>
        </select>
      </label>
      <label className="field">
        <span>Category</span>
        <select name="category" defaultValue="maintenance">
          <option value="maintenance">Maintenance</option>
          <option value="access">Access</option>
          <option value="information">Information</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="field">
        <span>Urgency</span>
        <select name="urgency" defaultValue="routine">
          <option value="routine">Routine</option>
          <option value="soon">Soon</option>
          <option value="urgent">Urgent</option>
          <option value="emergency">Emergency</option>
        </select>
      </label>
      <label className="field">
        <span>Issue summary</span>
        <textarea name="message" required />
      </label>
      <button className="button" type="submit" disabled={state.status === "submitting"}>
        Prepare support item
      </button>
      {state.message ? <p className="notice">{state.message}</p> : null}
    </form>
  );
}
