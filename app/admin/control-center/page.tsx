import { AgentMissionForm } from "@/components/AgentMissionForm";
import { StatusBadge } from "@/components/StatusBadge";
import { agentTeam, authorityContract, missionLifecycle, successScorecard } from "@/lib/agent-control-plane";
import { requireOwnerAccess } from "@/lib/auth";
import { runtimeSnapshot } from "@/lib/runtime-store";

export const dynamic = "force-dynamic";

export default async function ControlCenterPage() {
  await requireOwnerAccess("/admin/control-center");
  const snapshot = await runtimeSnapshot();
  const proofCount = Object.values(snapshot.counts).reduce((sum, value) => sum + value, 0);

  return (
    <main className="page">
      <div className="shell">
        <section className="control-header">
          <div className="stack">
            <span className="eyebrow">Owner control center</span>
            <h1 className="control-title">One accountable team. Every action leaves proof.</h1>
            <p className="lede">
              Queue bounded work, inspect authority, and run the property against owner, renter, vacancy, support, and implementation outcomes.
            </p>
          </div>
          <div className="control-posture">
            <span className="label">Current posture</span>
            <strong>{snapshot.health.mode === "database-ready" ? "Runtime connected" : "Template proof mode"}</strong>
            <p>{snapshot.health.capabilities.auth ? "Owner auth configured." : "Owner auth still needs production configuration."}</p>
            <StatusBadge tone={snapshot.health.mode === "database-ready" ? undefined : "warning"}>{snapshot.health.adapter}</StatusBadge>
          </div>
        </section>

        <section className="metric-strip" aria-label="Control-plane metrics">
          <div><span className="label">Specialists</span><strong>{agentTeam.length}</strong></div>
          <div><span className="label">Missions recorded</span><strong>{snapshot.counts["agent-mission"]}</strong></div>
          <div><span className="label">Proof events</span><strong>{proofCount}</strong></div>
          <div><span className="label">Unsafe actions enabled</span><strong>0</strong></div>
        </section>

        <section className="section control-grid">
          <div className="panel stack">
            <div>
              <span className="eyebrow">New mission</span>
              <h2>Give one specialist one measurable job.</h2>
            </div>
            <AgentMissionForm />
          </div>
          <div className="stack authority-panel">
            <div className="row">
              <div>
                <span className="eyebrow">Authority contract</span>
                <h2>Approval is not execution.</h2>
              </div>
              <StatusBadge tone="warning">{authorityContract.policyVersion}</StatusBadge>
            </div>
            <p>{authorityContract.controlledTransition}</p>
            <div className="blocked-list">
              {authorityContract.blockedActions.map((action) => <span key={action}>{action}</span>)}
            </div>
          </div>
        </section>

        <section className="section stack">
          <div>
            <span className="eyebrow">Mission lifecycle</span>
            <h2>Work moves through six visible states.</h2>
          </div>
          <div className="lifecycle">
            {missionLifecycle.map((stage, index) => (
              <div className="lifecycle-step" key={stage.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{stage.label}</strong>
                <p>{stage.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section control-grid">
          <div className="stack">
            <div>
              <span className="eyebrow">Team topology</span>
              <h2>Specialists with narrow mandates.</h2>
            </div>
            <div className="table-list">
              {agentTeam.map((profile) => (
                <div className="team-row" key={profile.id}>
                  <strong>{profile.label}</strong>
                  <p>{profile.mandate}</p>
                  <span>{profile.proof}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="stack">
            <div>
              <span className="eyebrow">Outcome scorecard</span>
              <h2>Targets owners and partners can audit.</h2>
            </div>
            <div className="score-list">
              {successScorecard.map((item) => (
                <div className="score-row" key={`${item.audience}-${item.metric}`}>
                  <div className="row"><span className="label">{item.audience}</span><strong>{item.target}</strong></div>
                  <p>{item.metric}</p>
                  <span>{item.evidence}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
