import Link from "next/link";
import { properties, listingDrafts } from "@/data/properties";
import { StatusBadge } from "@/components/StatusBadge";

export default function HomePage() {
  const property = properties[0];
  const ownerReviewCount = listingDrafts.filter((draft) => draft.status === "owner-review").length;

  return (
    <main className="page">
      <div className="shell">
        <section className="hero">
          <div className="stack">
            <span className="eyebrow">Repo-native property operations</span>
            <h1>Property Intelligence OS</h1>
            <p className="lede">
              A premium renter portal and owner dashboard built around approved facts, human approval gates, and Codex/Claude-ready workflows.
            </p>
            <div className="hero-actions">
              <Link className="button" href={`/properties/${property.slug}`}>Open sample property</Link>
              <Link className="button-secondary" href="/owner">Owner dashboard</Link>
            </div>
          </div>
          <div className="media-stage">
            <img src={property.imageUrl} alt="Sample property exterior" />
            <div className="media-overlay">
              <div className="signal-card">
                <span className="label">Portal</span>
                <strong>Approved facts only</strong>
              </div>
              <div className="signal-card">
                <span className="label">Listings</span>
                <strong>{ownerReviewCount} in owner review</strong>
              </div>
              <div className="signal-card">
                <span className="label">Support</span>
                <strong>Human approval gate</strong>
              </div>
              <div className="signal-card">
                <span className="label">Status</span>
                <strong><StatusBadge tone="warning">Template v0.1</StatusBadge></strong>
              </div>
            </div>
          </div>
        </section>

        <section className="section grid">
          <div className="panel">
            <h3>Public property page</h3>
            <p className="muted">Approved facts, real photography, rules, amenities, and inquiry capture.</p>
          </div>
          <div className="panel">
            <h3>Renter portal</h3>
            <p className="muted">Stay or rental-period information, support guidance, and owner-approved escalation paths.</p>
          </div>
          <div className="panel">
            <h3>Owner command view</h3>
            <p className="muted">Listing status, inquiries, support risk, vacancy pipeline, and weekly decisions.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

