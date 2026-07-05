import { integrations } from "@/lib/product";
import { StatusBadge } from "@/components/StatusBadge";
import { requireOwnerAccess } from "@/lib/auth";

const toneByStatus = {
  connected: undefined,
  planned: "warning",
  manual: "warning",
  later: "warning",
  blocked: "danger"
} as const;

export default async function IntegrationsPage() {
  await requireOwnerAccess("/admin/integrations");

  return (
    <main className="page">
      <div className="shell">
        <section className="work-header">
          <span className="eyebrow">Integration cockpit</span>
          <h1 className="page-title">Connect only what has a safe operating reason.</h1>
          <p className="lede">
            Property Intelligence OS starts manual where the market is fragile, then promotes integrations after field proof, API access, and owner approval gates are clear.
          </p>
        </section>

        <section className="grid">
          {integrations.map((integration) => (
            <article className="listing-card stack" key={integration.id}>
              <div className="row">
                <div>
                  <span className="label">{integration.category}</span>
                  <h3>{integration.label}</h3>
                </div>
                <StatusBadge tone={toneByStatus[integration.status]}>{integration.status}</StatusBadge>
              </div>
              <p className="muted">{integration.purpose}</p>
              <div className="mini-stack">
                <span className="label">Owner value</span>
                <p>{integration.ownerValue}</p>
              </div>
              <div className="mini-stack">
                <span className="label">Risk</span>
                <p className="muted">{integration.risk}</p>
              </div>
              <div className="notice">{integration.nextStep}</div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
