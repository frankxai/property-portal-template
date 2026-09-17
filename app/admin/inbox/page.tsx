import { OwnerInbox } from "@/components/OwnerInbox";
import { requireOwnerAccess } from "@/lib/auth";
import { listOwnerInbox } from "@/lib/owner-inbox";
import { ownerRoleHasCapability } from "@/lib/owner-capabilities";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OwnerInboxPage() {
  const access = await requireOwnerAccess("/admin/inbox");
  const canRead = ownerRoleHasCapability(access.role, "owner-inbox:read");
  const canWrite = ownerRoleHasCapability(access.role, "owner-inbox:write");
  const canClose = ownerRoleHasCapability(access.role, "owner-inbox:close");
  const canApprove = ownerRoleHasCapability(access.role, "approvals:decide");
  let initialError = "";
  const items = canRead ? await listOwnerInbox().catch(() => {
    initialError = "The owner inbox database is unavailable. No queue data was loaded.";
    return [];
  }) : [];

  return (
    <main className="page owner-inbox-page">
      <div className="shell owner-inbox-shell">
        <header className="owner-inbox-header">
          <div>
            <span className="eyebrow">Owner operations</span>
            <h1>Inbox</h1>
            <p>Inquiry and support work, ordered for decision.</p>
          </div>
          <div className="owner-inbox-zero-receipt" aria-label="External action receipt">
            <strong>0 external actions</strong>
            <span>Drafts, assignments, and decisions stay inside this workspace.</span>
          </div>
        </header>

        {canRead ? (
          <OwnerInbox
            initialItems={items}
            initialError={initialError}
            canWrite={canWrite}
            canClose={canClose}
            canApprove={canApprove}
            actorRole={access.role}
          />
        ) : (
          <section className="owner-inbox-blocked" role="alert">
            <span className="eyebrow">Unsupported role</span>
            <h2>Inbox access is not available.</h2>
            <p>Viewer and operator roles cannot read requester work or private request detail.</p>
          </section>
        )}
      </div>
    </main>
  );
}
