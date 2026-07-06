import Link from "next/link";
import { setupSteps } from "@/lib/product";
import { properties } from "@/data/properties";
import { StatusBadge } from "@/components/StatusBadge";
import { requireOwnerAccess } from "@/lib/auth";
import { createInstallProofPacket, type InstallProofStatus } from "@/lib/install-proof";

const toneByStatus = {
  ready: undefined,
  "needs-owner": "warning",
  recommended: "warning",
  later: "warning"
} as const;

const proofToneByStatus: Record<InstallProofStatus, "warning" | "danger" | undefined> = {
  ready: undefined,
  "needs-owner": "warning",
  configure: "warning",
  manual: "warning",
  blocked: "danger"
};

export default async function SetupPage() {
  await requireOwnerAccess("/admin/setup");
  const property = properties[0];
  const proofPacket = createInstallProofPacket();

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
            <div className="grid">
              <div className="metric">
                <span className="label">Install proof</span>
                <strong>{proofPacket.score}%</strong>
                <span>{proofPacket.posture}</span>
              </div>
              <div className="metric">
                <span className="label">Runtime</span>
                <strong>{proofPacket.runtimeMode}</strong>
                <span>{proofPacket.tenantModel}</span>
              </div>
              <div className="metric">
                <span className="label">Next actions</span>
                <strong>{proofPacket.nextActions.length}</strong>
                <span>before production</span>
              </div>
            </div>

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

        <section className="panel stack">
          <div className="row">
            <div>
              <span className="eyebrow">Install proof packet</span>
              <h2>Evidence, commands, and gates for a repeatable owner install.</h2>
            </div>
            <Link className="button-secondary" href="/api/install/proof-packet">View JSON</Link>
          </div>
          <p className="muted">
            This cockpit is deliberately strict: it separates community-fork readiness from owner preview and production readiness, and it reports only environment key names and configured booleans.
          </p>

          <div className="grid">
            {proofPacket.commandChecks.map((check) => (
              <article className="metric" key={check.command}>
                <span className="label">{check.requiredBefore}</span>
                <strong>{check.command}</strong>
                <span>{check.purpose}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="two-col">
          <div className="stack">
            {proofPacket.installPhases.map((phase) => (
              <article className="question-card stack" key={phase.id}>
                <div className="row">
                  <h3>{phase.title}</h3>
                  <StatusBadge tone={proofToneByStatus[phase.status]}>{phase.status}</StatusBadge>
                </div>
                <p className="muted">{phase.ownerOutcome}</p>
                <div>
                  <span className="label">Implementer action</span>
                  <p>{phase.implementerAction}</p>
                </div>
                <div>
                  <span className="label">Gate</span>
                  <p>{phase.gate}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="panel stack">
            <span className="eyebrow">Owner approval boundary</span>
            <h2>No consequential action leaves the workspace automatically.</h2>
            <p className="muted">{proofPacket.publicSafety.automationBoundary}</p>
            <div>
              <span className="label">Owner approval required for</span>
              <ul>
                {proofPacket.ownerApprovalRequiredFor.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <span className="label">Blocked in v1</span>
              <ul>
                {proofPacket.blockedV1Actions.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <span className="label">Missing production env</span>
              <ul>
                {proofPacket.requiredEnv.length > 0
                  ? proofPacket.requiredEnv.map((item) => <li key={item.name}>{item.name}</li>)
                  : <li>All required production env names are configured.</li>}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
