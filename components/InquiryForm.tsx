"use client";

import { useState } from "react";

type State = {
  status: "idle" | "submitting" | "done" | "error";
  message: string;
};

export function InquiryForm({ propertySlug }: { propertySlug: string }) {
  const [state, setState] = useState<State>({ status: "idle", message: "" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting", message: "Preparing sanitized owner review." });
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertySlug,
        name: formData.get("name"),
        email: formData.get("email"),
        rentalWindow: formData.get("rentalWindow"),
        message: formData.get("message")
      })
    });

    if (!response.ok) {
      setState({ status: "error", message: "The inquiry could not be prepared. Please try again." });
      return;
    }

    const result = await response.json() as { id: string; ownerApprovalRequired: boolean; route: string };
    setState({
      status: "done",
      message: `Inquiry ${result.id} is routed to ${result.route}. Owner approval required.`
    });
    event.currentTarget.reset();
  }

  return (
    <form className="form-card form-grid" onSubmit={submit}>
      <label className="field">
        <span>Name</span>
        <input name="name" autoComplete="name" required />
      </label>
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Rental window</span>
        <input name="rentalWindow" placeholder="Example: September to December" required />
      </label>
      <label className="field">
        <span>Question</span>
        <textarea name="message" required />
      </label>
      <button className="button" type="submit" disabled={state.status === "submitting"}>
        Prepare inquiry
      </button>
      {state.message ? <p className="notice">{state.message}</p> : null}
    </form>
  );
}
