"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { currentWeekOf, type WeeklyMetricObservation, type WeeklyOwnerReview } from "@/lib/weekly-review";

type CompletionForm = {
  repeatedQuestionsTotal: string;
  repeatedQuestionsCovered: string;
  knownVacancyDate: string;
  listingReadyDate: string;
  keepNote: string;
  changeNote: string;
  stopNote: string;
};

const emptyForm: CompletionForm = {
  repeatedQuestionsTotal: "",
  repeatedQuestionsCovered: "",
  knownVacancyDate: "",
  listingReadyDate: "",
  keepNote: "",
  changeNote: "",
  stopNote: ""
};

function metricTone(status: WeeklyMetricObservation["status"]): "default" | "warning" | "danger" {
  if (status === "not-met") return "danger";
  if (status === "unmeasured") return "warning";
  return "default";
}

function metricValue(observation: WeeklyMetricObservation) {
  if (observation.value === null) return "Unmeasured";
  const suffix = observation.unit === "percent" ? "%" : ` ${observation.unit}`;
  return `${observation.value}${suffix}`;
}

function readableDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00.000Z`));
}

function ReviewEvidence({ review }: { review: WeeklyOwnerReview }) {
  return (
    <article className="weekly-review-record">
      <header className="row weekly-review-record-header">
        <div className="mini-stack">
          <span className="eyebrow">Week of {readableDate(review.weekOf)}</span>
          <h3>{review.status === "completed" ? "Review evidence" : "Review in progress"}</h3>
        </div>
        <StatusBadge tone={review.status === "completed" ? "default" : "warning"}>{review.status}</StatusBadge>
      </header>

      {review.observations.length > 0 ? (
        <div className="weekly-metric-grid">
          {review.observations.map((observation) => (
            <div className="weekly-metric" key={observation.id}>
              <div className="row weekly-metric-heading">
                <span className="label">{observation.label}</span>
                <StatusBadge tone={metricTone(observation.status)}>{observation.status}</StatusBadge>
              </div>
              <strong>{metricValue(observation)}</strong>
              <p>{observation.target}</p>
              <small>{observation.source}</small>
            </div>
          ))}
        </div>
      ) : null}

      {review.status === "completed" ? (
        <dl className="weekly-decisions">
          <div><dt>Keep</dt><dd>{review.keepNote}</dd></div>
          <div><dt>Change</dt><dd>{review.changeNote}</dd></div>
          <div><dt>Stop</dt><dd>{review.stopNote}</dd></div>
        </dl>
      ) : null}
    </article>
  );
}

export function WeeklyReviewConsole({
  initialReviews,
  initialError = ""
}: {
  initialReviews: WeeklyOwnerReview[];
  initialError?: string;
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState<"start" | "complete" | null>(null);
  const [error, setError] = useState(initialError);
  const activeReview = useMemo(() => reviews.find((review) => review.status === "in-progress") ?? null, [reviews]);
  const currentReview = useMemo(() => reviews.find((review) => review.weekOf === currentWeekOf()) ?? null, [reviews]);
  const completedReviews = useMemo(() => reviews.filter((review) => review.status === "completed"), [reviews]);

  function updateForm(field: keyof CompletionForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function startReview() {
    setPending("start");
    setError("");
    try {
      const response = await fetch("/api/weekly-reviews", { method: "POST" });
      const payload = await response.json() as { review?: WeeklyOwnerReview; error?: string };
      if (!response.ok || !payload.review) throw new Error(payload.error || "Review start failed.");
      setReviews((current) => [payload.review as WeeklyOwnerReview, ...current.filter((item) => item.id !== payload.review?.id)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review start failed.");
    } finally {
      setPending(null);
    }
  }

  async function completeReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeReview) return;
    setPending("complete");
    setError("");
    try {
      const response = await fetch(`/api/weekly-reviews/${encodeURIComponent(activeReview.id)}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repeatedQuestionsTotal: Number(form.repeatedQuestionsTotal),
          repeatedQuestionsCovered: Number(form.repeatedQuestionsCovered),
          knownVacancyDate: form.knownVacancyDate || null,
          listingReadyDate: form.listingReadyDate || null,
          keepNote: form.keepNote,
          changeNote: form.changeNote,
          stopNote: form.stopNote
        })
      });
      const payload = await response.json() as { review?: WeeklyOwnerReview; error?: string };
      if (!response.ok || !payload.review) throw new Error(payload.error || "Review completion failed.");
      setReviews((current) => [payload.review as WeeklyOwnerReview, ...current.filter((item) => item.id !== payload.review?.id)]);
      setForm(emptyForm);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review completion failed.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="section weekly-review-console" aria-live="polite">
      <div className="row weekly-review-toolbar">
        <div>
          <span className="eyebrow">Measured operating loop</span>
          <h2>Weekly owner review</h2>
        </div>
        {!currentReview ? (
          <button className="button" type="button" disabled={pending !== null} onClick={startReview}>
            {pending === "start" ? "Starting..." : "Start this week"}
          </button>
        ) : currentReview.status === "in-progress" ? (
          <StatusBadge tone="warning">timer active</StatusBadge>
        ) : (
          <StatusBadge>week complete</StatusBadge>
        )}
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {activeReview ? (
        <form className="weekly-review-form" onSubmit={completeReview}>
          <header className="weekly-form-header">
            <span className="label">Started {activeReview.startedAt.replace("T", " ").slice(0, 16)} UTC</span>
            <h3>Record the week as it is</h3>
          </header>

          <div className="weekly-input-grid">
            <label className="field">
              <span>Repeated questions received</span>
              <input required min="0" max="10000" step="1" type="number" value={form.repeatedQuestionsTotal} onChange={(event) => updateForm("repeatedQuestionsTotal", event.target.value)} />
            </label>
            <label className="field">
              <span>Answered by approved self-service content</span>
              <input required min="0" max="10000" step="1" type="number" value={form.repeatedQuestionsCovered} onChange={(event) => updateForm("repeatedQuestionsCovered", event.target.value)} />
            </label>
            <label className="field">
              <span>Listing ready date</span>
              <input type="date" value={form.listingReadyDate} onChange={(event) => updateForm("listingReadyDate", event.target.value)} />
            </label>
            <label className="field">
              <span>Known vacancy date</span>
              <input type="date" value={form.knownVacancyDate} onChange={(event) => updateForm("knownVacancyDate", event.target.value)} />
            </label>
          </div>

          <div className="weekly-decision-inputs">
            <label className="field">
              <span>Keep</span>
              <textarea className="compact-textarea" required maxLength={1200} value={form.keepNote} onChange={(event) => updateForm("keepNote", event.target.value)} />
            </label>
            <label className="field">
              <span>Change</span>
              <textarea className="compact-textarea" required maxLength={1200} value={form.changeNote} onChange={(event) => updateForm("changeNote", event.target.value)} />
            </label>
            <label className="field">
              <span>Stop</span>
              <textarea className="compact-textarea" required maxLength={1200} value={form.stopNote} onChange={(event) => updateForm("stopNote", event.target.value)} />
            </label>
          </div>

          <footer className="row weekly-form-footer">
            <p>Completion records five metric observations. Missing operational evidence remains unmeasured.</p>
            <button className="button" type="submit" disabled={pending !== null}>
              {pending === "complete" ? "Recording..." : "Complete review"}
            </button>
          </footer>
        </form>
      ) : currentReview?.status === "completed" ? (
        <div className="weekly-review-empty">
          <strong>This week is complete.</strong>
          <span>The original metric evidence stays fixed. Begin a new review when the next UTC week opens.</span>
        </div>
      ) : (
        <div className="weekly-review-empty">
          <strong>No timer is running.</strong>
          <span>Start once per week. The server records duration and keeps one review per organization and week.</span>
        </div>
      )}

      {completedReviews.length > 0 ? (
        <div className="weekly-review-history">
          {completedReviews.map((review) => <ReviewEvidence review={review} key={review.id} />)}
        </div>
      ) : null}

      <p className="weekly-review-boundary">
        The zero-action metric covers this product's governed action surface. It does not claim visibility into disconnected tools or manual owner activity.
      </p>
    </section>
  );
}
