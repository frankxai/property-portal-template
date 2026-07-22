import { operatingCadence, releaseGates, successCriteria, tastePrinciples } from "@/lib/ops";
import { StatusBadge } from "@/components/StatusBadge";
import { WeeklyReviewConsole } from "@/components/WeeklyReviewConsole";
import { requireOwnerAccess } from "@/lib/auth";
import { listWeeklyOwnerReviews } from "@/lib/runtime-store";
import type { WeeklyOwnerReview } from "@/lib/weekly-review";

function GateBadge({ status }: { status: "required" | "ready" | "manual" }) {
  if (status === "ready") {
    return <StatusBadge>ready</StatusBadge>;
  }

  return <StatusBadge tone="warning">{status}</StatusBadge>;
}

export default async function OpsPage() {
  await requireOwnerAccess("/admin/ops");
  let weeklyReviews: WeeklyOwnerReview[] = [];
  let weeklyReviewError = "";
  try {
    weeklyReviews = await listWeeklyOwnerReviews(12);
  } catch {
    weeklyReviewError = "Weekly evidence is unavailable. Keep the manual review route active until storage recovers.";
  }

  return (
    <main className="page">
      <div className="shell">
        <section className="work-header">
          <span className="eyebrow">Operating system</span>
          <h1 className="page-title">A measured operating rhythm for every property.</h1>
          <p className="lede">
            Start the weekly review, record what changed, and leave an honest evidence trail before the next owner decision.
          </p>
        </section>

        <WeeklyReviewConsole initialReviews={weeklyReviews} initialError={weeklyReviewError} />

        <section className="grid">
          {successCriteria.map((item) => (
            <article className="metric" key={item.title}>
              <span className="label">Success criteria</span>
              <strong>{item.title}</strong>
              <p className="muted">{item.detail}</p>
            </article>
          ))}
        </section>

        <section className="section two-col">
          <div className="panel stack">
            <span className="eyebrow">Cadence</span>
            <h2>Owner operating loop</h2>
            {operatingCadence.map((item) => (
              <div className="question-card" key={item.title}>
                <h3>{item.title}</h3>
                <p className="muted">{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="panel stack">
            <span className="eyebrow">Taste</span>
            <h2>Premium without theater</h2>
            {tastePrinciples.map((item) => (
              <div className="question-card" key={item.title}>
                <h3>{item.title}</h3>
                <p className="muted">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section stack">
          <span className="eyebrow">Release gate</span>
          <h2>Before this goes live</h2>
          {releaseGates.map((gate) => (
            <article className="listing-card stack" key={gate.title}>
              <div className="row">
                <h3>{gate.title}</h3>
                <GateBadge status={gate.status} />
              </div>
              <p className="muted">{gate.detail}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
