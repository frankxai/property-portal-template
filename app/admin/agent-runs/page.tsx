import { sampleAgentRuns } from "@/lib/product";
import { StatusBadge } from "@/components/StatusBadge";
import { requireOwnerAccess } from "@/lib/auth";

const toneByRisk = {
  low: undefined,
  medium: "warning",
  high: "danger",
  "owner-required": "warning"
} as const;

export default async function AgentRunsPage() {
  await requireOwnerAccess("/admin/agent-runs");

  return (
    <main className="page">
      <div className="shell">
        <section className="work-header">
          <span className="eyebrow">Agent run ledger</span>
          <h1 className="page-title">Agents draft work; the owner keeps authority.</h1>
          <p className="lede">
            The product advantage is not uncontrolled automation. It is a clear ledger of agent work, approval risk, and the exact owner action required.
          </p>
        </section>

        <section className="stack">
          {sampleAgentRuns.map((run) => (
            <article className="listing-card stack" key={run.id}>
              <div className="row">
                <div>
                  <span className="label">{run.role}</span>
                  <h3>{run.trigger}</h3>
                </div>
                <StatusBadge tone={toneByRisk[run.approvalRisk]}>{run.approvalRisk}</StatusBadge>
              </div>
              <p>{run.output}</p>
              <p className="notice">{run.ownerAction}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
