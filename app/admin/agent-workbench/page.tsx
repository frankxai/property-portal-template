import Link from "next/link";
import { AgentWorkbench } from "@/components/AgentWorkbench";
import { StatusBadge } from "@/components/StatusBadge";
import { requireOwnerAccess } from "@/lib/auth";
import { runtimeHealth } from "@/lib/runtime-contracts";

export const dynamic = "force-dynamic";

export default async function AgentWorkbenchPage() {
  await requireOwnerAccess("/admin/agent-workbench");
  const health = runtimeHealth();
  const connected = health.capabilities.agentRuntime;

  return (
    <main className="page">
      <div className="shell">
        <section className="control-header workbench-header">
          <div className="stack">
            <span className="eyebrow">Governed agent workbench</span>
            <h1 className="control-title">From approved fact to reviewable work.</h1>
            <p className="lede">Scope one mission, freeze its evidence, inspect the structured draft, and record the owner decision. No step sends, publishes, prices, promises, or dispatches.</p>
            <div className="hero-actions">
              <Link className="button-secondary" href="/admin/control-center">Team and outcomes</Link>
              <Link className="button-secondary" href="/admin/runtime">Runtime proof</Link>
            </div>
          </div>
          <div className="control-posture">
            <span className="label">Execution posture</span>
            <strong>{connected ? "Control plane connected" : "Control plane locked"}</strong>
            <p>{connected ? "Authenticated MCP, tenant scope, evidence ledger, and model runtime are configured." : "The workflow is visible, but every write remains unavailable until the governed runtime is configured."}</p>
            <StatusBadge tone={connected ? undefined : "warning"}>{connected ? "ready for owner-supervised use" : "fail-closed"}</StatusBadge>
          </div>
        </section>

        <section className="metric-strip workbench-metrics" aria-label="Agent workbench controls">
          <div><span className="label">Authority</span><strong>Draft only</strong></div>
          <div><span className="label">Evidence source</span><strong>Approved ledger</strong></div>
          <div><span className="label">Model tools</span><strong>0</strong></div>
          <div><span className="label">External actions</span><strong>0</strong></div>
        </section>

        <AgentWorkbench connected={connected} />
      </div>
    </main>
  );
}
