import Link from "next/link";
import { listingDrafts, properties } from "@/data/properties";
import { StatusBadge } from "@/components/StatusBadge";
import { requireOwnerAccess } from "@/lib/auth";

export default async function OwnerPage() {
  await requireOwnerAccess("/owner");
  const property = properties[0];
  const waitingListings = listingDrafts.filter((draft) => draft.status === "owner-review");

  return (
    <main className="page">
      <div className="shell">
        <section className="work-header">
          <span className="eyebrow">Owner dashboard</span>
          <h1 className="page-title">One place for listings, renter knowledge, support risk, and weekly decisions.</h1>
        </section>

        <section className="grid">
          <div className="metric">
            <span className="label">Properties</span>
            <strong>{properties.length}</strong>
          </div>
          <div className="metric">
            <span className="label">Listings awaiting review</span>
            <strong>{waitingListings.length}</strong>
          </div>
          <div className="metric">
            <span className="label">Automation level</span>
            <strong>Draft and approve</strong>
          </div>
        </section>

        <section className="section two-col">
          <div className="panel stack">
            <div className="row">
              <h2>{property.name}</h2>
              <StatusBadge tone="warning">Owner approval gates active</StatusBadge>
            </div>
            <p className="muted">{property.shortDescription}</p>
            <Link className="button-secondary" href={`/properties/${property.slug}`}>Open property page</Link>
          </div>
          <div className="panel stack">
            <h3>Weekly decisions</h3>
            <p className="muted">Confirm public facts, approve listing copy, review missing renter FAQ answers, and resolve maintenance commitments.</p>
            <Link className="button" href="/admin/listings">Review listings</Link>
            <Link className="button-secondary" href="/admin/setup">Open setup checklist</Link>
            <Link className="button-secondary" href="/admin/agent-runs">Review agent ledger</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
