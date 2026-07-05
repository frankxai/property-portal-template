import { notFound } from "next/navigation";
import { PropertyHero } from "@/components/PropertyHero";
import { StatusBadge } from "@/components/StatusBadge";
import { getProperty, properties } from "@/data/properties";

export function generateStaticParams() {
  return properties.map((property) => ({ slug: property.slug }));
}

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = getProperty(slug);
  if (!property) notFound();

  return (
    <main className="page">
      <div className="shell">
        <PropertyHero property={property} />

        <section className="section two-col">
          <div className="stack">
            <h2>Approved renter knowledge</h2>
            <div className="grid">
              {property.faq.map((article) => (
                <article className="question-card" key={article.id}>
                  <div className="row">
                    <h3>{article.title}</h3>
                    <StatusBadge>{article.approvalStatus}</StatusBadge>
                  </div>
                  <p className="muted">{article.answer}</p>
                </article>
              ))}
            </div>
          </div>
          <aside className="panel stack">
            <h3>Property facts</h3>
            <p className="muted">{property.shortDescription}</p>
            <div>
              <span className="label">Amenities</span>
              <ul>
                {property.amenities.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <span className="label">Premium signals</span>
              <ul>
                {property.premiumSignals.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <span className="label">Rules</span>
              <ul>
                {property.rules.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <p className="notice">{property.imageCredit}</p>
          </aside>
        </section>
      </div>
    </main>
  );
}
