import { notFound } from "next/navigation";
import { InquiryForm } from "@/components/InquiryForm";
import { getProperty, properties } from "@/data/properties";

export function generateStaticParams() {
  return properties.map((property) => ({ slug: property.slug }));
}

export default async function InquirePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = getProperty(slug);
  if (!property) notFound();

  return (
    <main className="page">
      <div className="shell two-col">
        <section className="stack">
          <span className="eyebrow">{property.location.publicArea}</span>
          <h1 className="page-title">Inquiry for {property.name}</h1>
          <p className="lede">
            This form prepares a sanitized owner review. It does not promise availability, pricing, lease terms, or acceptance.
          </p>
          <p className="notice">
            Availability, rent, lease, deposit, repair, and legal questions require owner approval.
          </p>
        </section>
        <InquiryForm propertySlug={property.slug} />
      </div>
    </main>
  );
}

