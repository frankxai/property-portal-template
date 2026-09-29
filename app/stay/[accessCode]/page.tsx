import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { resolveRenterStay } from "@/lib/renter-access";

export const dynamic = "force-dynamic";

export default async function StayPage({ params }: { params: Promise<{ accessCode: string }> }) {
  const { accessCode } = await params;
  const requestHeaders = await headers();
  const requestIdentifier = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || requestHeaders.get("x-real-ip")
    || "unknown";
  const stay = await resolveRenterStay(accessCode, { requestIdentifier });
  if (!stay) notFound();

  return (
    <main className="page">
      <div className="shell">
        <section className="section stack">
          <div className="row">
            <span className="eyebrow">{stay.rentalLabel || "Renter portal"}</span>
            <StatusBadge>{stay.demo ? "demo" : "active"}</StatusBadge>
          </div>
          <h1 className="page-title">{stay.propertyName} renter portal</h1>
          <p className="lede">
            Approved self-service information for the rental period. Private access details stay in the owner-approved private channel.
          </p>
          {stay.expiresAt ? (
            <p className="muted">Portal access expires {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(stay.expiresAt))}.</p>
          ) : null}
        </section>

        <section className="grid">
          {stay.sections.map((section) => (
            <article className="question-card" key={section.id}>
              <div className="row">
                <h3>{section.title}</h3>
                <StatusBadge>approved</StatusBadge>
              </div>
              <p className="muted">{section.answer}</p>
            </article>
          ))}
          {stay.sections.length === 0 ? (
            <article className="question-card">
              <h3>No approved guidance yet</h3>
              <p className="muted">Contact the owner through the approved private channel.</p>
            </article>
          ) : null}
        </section>
      </div>
    </main>
  );
}
