import Link from "next/link";
import { implementationReadiness } from "@/lib/implementation";
import { StatusBadge } from "@/components/StatusBadge";
import { requireOwnerAccess } from "@/lib/auth";
import type { ImplementationStatus } from "@/lib/types";

const toneByStatus: Record<ImplementationStatus, "warning" | "danger" | undefined> = {
  ready: undefined,
  manual: "warning",
  configure: "warning",
  planned: "warning",
  blocked: "danger"
};

export default async function ImplementationPage() {
  await requireOwnerAccess("/admin/implementation");
  const readiness = implementationReadiness();

  return (
    <main className="page">
      <div className="shell">
        <section className="work-header">
          <span className="eyebrow">Implementation cockpit</span>
          <h1 className="page-title">Turn the template into a real property operating business without losing the safety model.</h1>
          <p className="lede">
            This is the install map for owners, agencies, and implementation partners: what is ready, what remains manual, what must be configured, and what stays blocked until owner approval and integration proof exist.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/admin/setup">Owner setup</Link>
            <Link className="button-secondary" href="/admin/integrations">Integration cockpit</Link>
            <Link className="button-secondary" href="/api/implementation/readiness">Readiness JSON</Link>
          </div>
        </section>

        <section className="grid">
          <div className="metric">
            <span className="label">Install readiness</span>
            <strong>{readiness.score}%</strong>
            <p className="muted">{readiness.posture}</p>
          </div>
          <div className="metric">
            <span className="label">Runtime mode</span>
            <strong>{readiness.runtimeMode}</strong>
            <p className="muted">{readiness.tenantModel}</p>
          </div>
          <div className="metric">
            <span className="label">Setup progress</span>
            <strong>{readiness.setupReady}/{readiness.setupTotal}</strong>
            <p className="muted">Owner workspace gates ready</p>
          </div>
        </section>

        <section className="section two-col">
          <div className="panel stack">
            <span className="eyebrow">Production gates</span>
            <h2>Configure before real renter data</h2>
            {readiness.missingEnv.length > 0 ? (
              <ul>
                {readiness.missingEnv.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p className="muted">Required runtime environment variables are present. Verify auth, row-level security, backups, and retention before production.</p>
            )}
            <div className="notice">
              Every consequential action remains owner-approved: pricing, availability, leases, refunds, urgent repairs, vendor dispatch, listing publication, renter messages, and access information.
            </div>
          </div>

          <div className="panel stack">
            <span className="eyebrow">Blocked in v1</span>
            <h2>Manual by design</h2>
            <ul>
              {readiness.blockedV1Actions.map((action) => <li key={action}>{action}</li>)}
            </ul>
            <p className="muted">
              These are not missing features. They are trust boundaries until the owner, legal process, and integration provider prove a safe path.
            </p>
          </div>
        </section>

        <section className="section stack">
          <span className="eyebrow">Architecture layers</span>
          <h2>What an install partner actually delivers</h2>
          <div className="grid">
            {readiness.layers.map((layer) => (
              <article className="listing-card stack" key={layer.id}>
                <div className="row">
                  <h3>{layer.title}</h3>
                  <StatusBadge tone={toneByStatus[layer.status]}>{layer.status}</StatusBadge>
                </div>
                <p>{layer.ownerValue}</p>
                <div className="mini-stack">
                  <span className="label">Implementer action</span>
                  <p className="muted">{layer.implementerAction}</p>
                </div>
                <div className="mini-stack">
                  <span className="label">Evidence</span>
                  <p className="muted">{layer.evidence.join(" / ")}</p>
                </div>
                <div className="notice">{layer.productionGate}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="section stack">
          <span className="eyebrow">Business model</span>
          <h2>Free community value, paid implementation leverage</h2>
          <div className="grid">
            {readiness.partnerOffers.map((offer) => (
              <article className="question-card stack" key={offer.id}>
                <div>
                  <span className="label">{offer.buyer}</span>
                  <h3>{offer.title}</h3>
                </div>
                <p className="muted">{offer.priceSignal}</p>
                <ul>
                  {offer.includes.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <div className="notice">{offer.deliveryGate}</div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
