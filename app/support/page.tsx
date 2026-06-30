import { SupportForm } from "@/components/SupportForm";

export default function SupportPage() {
  return (
    <main className="page">
      <div className="shell two-col">
        <section className="stack">
          <span className="eyebrow">Support triage</span>
          <h1 className="page-title">Route renter questions without losing owner control.</h1>
          <p className="lede">
            The support form prepares a sanitized triage item. The owner still approves commitments, repair timing, vendor routing, and urgent escalation paths.
          </p>
          <div className="panel">
            <h3>Escalation rules</h3>
            <p className="muted">Emergency, legal, payment, access, and private-data issues require human review.</p>
          </div>
        </section>
        <SupportForm />
      </div>
    </main>
  );
}

