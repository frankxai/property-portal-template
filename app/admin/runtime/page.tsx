import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { runtimeSnapshot } from "@/lib/runtime-store";

export default async function RuntimePage() {
  const snapshot = await runtimeSnapshot();
  const { health } = snapshot;

  return (
    <main className="page">
      <div className="shell">
        <section className="work-header">
          <span className="eyebrow">Runtime control</span>
          <h1 className="page-title">See what the portal is actually recording before real renter data enters the system.</h1>
          <p className="lede">
            This surface separates safe demo mode from production runtime storage, notification handoff, agent writes, approval queues, and audit evidence.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/api/runtime/snapshot">Runtime JSON</Link>
            <Link className="button-secondary" href="/admin/implementation">Implementation cockpit</Link>
            <Link className="button-secondary" href="/admin/agent-runs">Agent ledger</Link>
          </div>
        </section>

        <section className="grid">
          <div className="metric">
            <span className="label">Runtime mode</span>
            <strong>{health.mode}</strong>
            <p className="muted">{health.adapter}</p>
          </div>
          <div className="metric">
            <span className="label">Tenant model</span>
            <strong>{health.tenantModel}</strong>
            <p className="muted">Switches with database configuration</p>
          </div>
          <div className="metric">
            <span className="label">Notification mode</span>
            <strong>{health.notificationMode}</strong>
            <p className="muted">Sanitized owner handoff only</p>
          </div>
        </section>

        <section className="section two-col">
          <div className="panel stack">
            <span className="eyebrow">Capabilities</span>
            <h2>Production adapters</h2>
            {Object.entries(health.capabilities).map(([name, enabled]) => (
              <div className="row" key={name}>
                <span>{name}</span>
                <StatusBadge tone={enabled ? undefined : "warning"}>{enabled ? "configured" : "missing"}</StatusBadge>
              </div>
            ))}
          </div>

          <div className="panel stack">
            <span className="eyebrow">Missing environment</span>
            <h2>Before production</h2>
            {health.missingEnv.length > 0 ? (
              <ul>
                {health.missingEnv.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p className="muted">Required runtime variables are present. Verify schema, seed data, auth, retention, and backups.</p>
            )}
            <p className="muted">Optional adapters: {health.optionalEnv.join(", ")}</p>
          </div>
        </section>

        <section className="section stack">
          <span className="eyebrow">Runtime counts</span>
          <h2>Operational queue shape</h2>
          <div className="grid">
            {Object.entries(snapshot.counts).map(([name, count]) => (
              <div className="metric" key={name}>
                <span className="label">{name}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="section two-col">
          <div className="panel stack">
            <span className="eyebrow">Recent queue</span>
            <h2>Sanitized work only</h2>
            {snapshot.recentQueue.length > 0 ? snapshot.recentQueue.map((item) => (
              <article className="question-card stack" key={item.id}>
                <div className="row">
                  <h3>{item.kind}</h3>
                  <StatusBadge tone={item.ownerApprovalRequired ? "warning" : undefined}>
                    {item.ownerApprovalRequired ? "owner review" : "weekly review"}
                  </StatusBadge>
                </div>
                <p>{item.sanitizedSummary}</p>
                <p className="muted">{item.ownerAction}</p>
              </article>
            )) : (
              <p className="muted">No runtime queue items in this process yet.</p>
            )}
          </div>

          <div className="panel stack">
            <span className="eyebrow">Production notes</span>
            <h2>Do not skip these</h2>
            {snapshot.productionNotes.map((note) => (
              <div className="notice" key={note}>{note}</div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
