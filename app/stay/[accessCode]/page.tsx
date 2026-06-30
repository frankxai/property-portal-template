import { notFound } from "next/navigation";
import { getProperty, getStaySession, staySessions } from "@/data/properties";
import { StatusBadge } from "@/components/StatusBadge";

export function generateStaticParams() {
  return staySessions.map((session) => ({ accessCode: session.accessCode }));
}

export default async function StayPage({ params }: { params: Promise<{ accessCode: string }> }) {
  const { accessCode } = await params;
  const session = getStaySession(accessCode);
  if (!session) notFound();
  const property = getProperty(session.propertySlug);
  if (!property) notFound();

  return (
    <main className="page">
      <div className="shell">
        <section className="section stack">
          <div className="row">
            <span className="eyebrow">{session.label}</span>
            <StatusBadge>{session.status}</StatusBadge>
          </div>
          <h1 className="page-title">{property.name} renter portal</h1>
          <p className="lede">
            Approved self-service information for the rental period. Private access details stay in the owner-approved private channel.
          </p>
        </section>

        <section className="grid">
          {session.sections.map((section) => (
            <article className="question-card" key={section.id}>
              <div className="row">
                <h3>{section.title}</h3>
                <StatusBadge>{section.approvalStatus}</StatusBadge>
              </div>
              <p className="muted">{section.answer}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

