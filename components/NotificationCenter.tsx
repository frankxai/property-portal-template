"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import type { NotificationDelivery } from "@/lib/notification-policy";

function statusTone(status: NotificationDelivery["status"]): "default" | "warning" | "danger" {
  if (["failed", "fallback-required", "fallback-failed"].includes(status)) return "danger";
  if (["queued", "processing", "sent", "fallback-sent"].includes(status)) return "warning";
  return "default";
}

function readableTime(value: string | null) {
  return value ? `${value.replace("T", " ").slice(0, 16)} UTC` : "not recorded";
}

export function NotificationCenter({
  initialDeliveries,
  initialError = ""
}: {
  initialDeliveries: NotificationDelivery[];
  initialError?: string;
}) {
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState(initialError);

  async function refresh() {
    setError("");
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) {
      setError("Could not refresh notification evidence.");
      return;
    }
    const payload = await response.json() as { deliveries: NotificationDelivery[] };
    setDeliveries(payload.deliveries);
  }

  async function acknowledge(id: string) {
    setPendingId(id);
    setError("");
    const response = await fetch(`/api/notifications/${encodeURIComponent(id)}/acknowledge`, { method: "POST" });
    if (!response.ok) {
      setError("Acknowledgement was not recorded. Keep the manual route active.");
      setPendingId(null);
      return;
    }
    const payload = await response.json() as { delivery: NotificationDelivery };
    setDeliveries((items) => items.map((item) => item.id === id ? payload.delivery : item));
    setPendingId(null);
  }

  return (
    <section className="section stack" aria-live="polite">
      <div className="row notification-toolbar">
        <div>
          <span className="eyebrow">Delivery ledger</span>
          <h2>Owner acknowledgement queue</h2>
        </div>
        <button className="button-secondary" type="button" onClick={refresh}>Refresh</button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {deliveries.length > 0 ? (
        <div className="notification-grid">
          {deliveries.map((delivery) => (
            <article className="question-card notification-card stack" key={delivery.id}>
              <div className="row">
                <div className="mini-stack">
                  <span className="eyebrow">{delivery.urgency} / {delivery.kind}</span>
                  <h3>{delivery.route}</h3>
                </div>
                <StatusBadge tone={statusTone(delivery.status)}>{delivery.status}</StatusBadge>
              </div>
              <p>{delivery.sanitizedSummary}</p>
              <p className="muted">{delivery.ownerAction}</p>
              <dl className="notification-meta">
                <div><dt>Primary attempts</dt><dd>{delivery.primaryAttemptCount}</dd></div>
                <div><dt>Fallback attempts</dt><dd>{delivery.fallbackAttemptCount}</dd></div>
                <div><dt>Delivered</dt><dd>{readableTime(delivery.deliveredAt ?? delivery.fallbackDeliveredAt)}</dd></div>
                <div><dt>Acknowledged</dt><dd>{readableTime(delivery.acknowledgedAt)}</dd></div>
              </dl>
              <div className="proof-line">
                <span>Payload SHA-256</span>
                <code>{delivery.payloadHash}</code>
              </div>
              {delivery.status !== "acknowledged" ? (
                <button
                  className="button-secondary"
                  type="button"
                  disabled={pendingId === delivery.id}
                  onClick={() => acknowledge(delivery.id)}
                >
                  {pendingId === delivery.id ? "Recording..." : "Acknowledge"}
                </button>
              ) : (
                <p className="muted">Acknowledgement is recorded. No renter reply, vendor dispatch, or other external action occurred.</p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="notice">No notification receipts exist yet. Submit a sample inquiry or support item to exercise the outbox.</div>
      )}
    </section>
  );
}
