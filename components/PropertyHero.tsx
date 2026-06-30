import Link from "next/link";
import type { PropertyProfile } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";

export function PropertyHero({ property }: { property: PropertyProfile }) {
  const unit = property.units[0];

  return (
    <section className="hero">
      <div className="stack">
        <span className="eyebrow">{property.location.publicArea}</span>
        <h1>{property.name}</h1>
        <p className="lede">{property.longDescription}</p>
        <div className="hero-actions">
          <Link className="button" href={`/properties/${property.slug}/inquire`}>
            Request owner review
          </Link>
          <Link className="button-secondary" href="/stay/sample-stay">
            View renter portal
          </Link>
        </div>
      </div>
      <div className="media-stage">
        <img src={property.imageUrl} alt={`${property.name} exterior sample`} />
        <div className="media-overlay">
          <div className="signal-card">
            <span className="label">Portal status</span>
            <strong>{property.status}</strong>
          </div>
          <div className="signal-card">
            <span className="label">Availability</span>
            <strong>{unit.availabilityNote}</strong>
          </div>
          <div className="signal-card">
            <span className="label">Unit</span>
            <strong>{unit.bedrooms} bedroom, up to {unit.maxOccupancy}</strong>
          </div>
          <div className="signal-card">
            <span className="label">Approval gate</span>
            <strong><StatusBadge tone="warning">Owner required</StatusBadge></strong>
          </div>
        </div>
      </div>
    </section>
  );
}

