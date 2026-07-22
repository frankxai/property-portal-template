import Link from "next/link";
import { NotificationCenter } from "@/components/NotificationCenter";
import { requireOwnerAccess } from "@/lib/auth";
import { runtimeHealth } from "@/lib/runtime-contracts";
import { listNotificationDeliveries } from "@/lib/runtime-store";

export default async function NotificationsPage() {
  await requireOwnerAccess("/admin/notifications");
  const health = runtimeHealth();
  let ledgerError = "";
  const deliveries = await listNotificationDeliveries(50).catch(() => {
    ledgerError = "The notification ledger is unavailable. Keep the manual urgent route active and check database health.";
    return [];
  });
  const urgentOpen = deliveries.filter((item) => item.urgency === "urgent" && item.status !== "acknowledged").length;
  const failed = deliveries.filter((item) => ["failed", "fallback-required", "fallback-failed"].includes(item.status)).length;
  const acknowledged = deliveries.filter((item) => item.status === "acknowledged").length;

  return (
    <main className="page">
      <div className="shell">
        <section className="work-header">
          <span className="eyebrow">Notification operations</span>
          <h1 className="page-title notification-page-title">Know what reached the owner, what failed, and what still needs acknowledgement.</h1>
          <p className="lede">
            The durable outbox records sanitized hashes before delivery. A scoped worker handles bounded retries and fallback; acknowledgement never sends or applies content.
          </p>
          <div className="hero-actions">
            <Link className="button-secondary" href="/admin/runtime">Runtime</Link>
            <Link className="button-secondary" href="/support">Submit support test</Link>
          </div>
        </section>

        <section className="grid notification-metrics">
          <div className="metric"><span className="label">Delivery mode</span><strong>{health.notificationMode}</strong></div>
          <div className="metric"><span className="label">Urgent open</span><strong>{urgentOpen}</strong></div>
          <div className="metric"><span className="label">Failures</span><strong>{failed}</strong></div>
          <div className="metric"><span className="label">Acknowledged</span><strong>{acknowledged}</strong></div>
        </section>

        <NotificationCenter initialDeliveries={deliveries} initialError={ledgerError} />
      </div>
    </main>
  );
}
