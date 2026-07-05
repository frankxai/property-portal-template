import { listingDrafts } from "@/data/properties";
import { StatusBadge } from "@/components/StatusBadge";

export default function ListingsAdminPage() {
  return (
    <main className="page">
      <div className="shell">
        <section className="work-header">
          <span className="eyebrow">Listing draft studio</span>
          <h1 className="page-title">Channel-ready drafts, still under owner control.</h1>
          <p className="lede">
            These drafts are for manual review and publishing. No channel posting or scraping is wired in v1.
          </p>
        </section>

        <section className="stack">
          {listingDrafts.map((draft) => (
            <article className="listing-card stack" key={draft.id}>
              <div className="row">
                <div>
                  <span className="label">{draft.channel}</span>
                  <h3>{draft.headline}</h3>
                </div>
                <StatusBadge tone="warning">{draft.status}</StatusBadge>
              </div>
              <p className="muted">{draft.body}</p>
              <div>
                <span className="label">Publication mode</span>
                <p>{draft.publicationMode}</p>
              </div>
              <div>
                <span className="label">Missing facts</span>
                <ul>
                  {draft.missingFacts.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div>
                <span className="label">Owner checklist</span>
                <ul>
                  {draft.ownerChecklist.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
