import Link from "next/link";
import { setupSteps } from "@/lib/product";
import { properties } from "@/data/properties";
import { StatusBadge } from "@/components/StatusBadge";

const toneByStatus = {
  ready: undefined,
  "needs-owner": "warning",
  recommended: "warning",
  later: "warning"
} as const;

export default function SetupPage() {
  const property = properties[0];

  return (
    <main className="page">
      <div className="shell">
        <section className="work-header">
          <span className="eyebrow">Self-service setup</span>
          <h1 className="page-title">Launch the first owner workspace without skipping the hard decisions.</h1>
          <p className="lede">
            A property owner should be able to go from blank workspace to premium public page, inquiry capture, renter portal, and owner review loop in one focused setup session.
          </p>
        </section>

        <section className="two-col">
          <div className="panel stack">
            <h2>{property.name}</h2>
            <p className="muted">{property.longDescription}</p>
            <div>
              <span className="label">Owner checklist</span>
              <ul>
                {property.ownerChecklist.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <Link className="button" href={`/properties/${property.slug}`}>Review property page</Link>
          </div>

          <div className="stack">
            {setupSteps.map((step) => (
              <article className="question-card stack" key={step.id}>
                <div className="row">
                  <h3>{step.title}</h3>
                  <StatusBadge tone={toneByStatus[step.status]}>{step.status}</StatusBadge>
                </div>
                <p className="muted">{step.outcome}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
