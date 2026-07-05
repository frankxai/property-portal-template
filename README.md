# Property Portal Template

Vercel/Next.js template for a premium rental-property website, renter self-service portal, inquiry capture, support intake, owner dashboard, and listing draft admin.

## Routes

- `/`: operating dashboard entry point
- `/properties/[slug]`: public property page
- `/properties/[slug]/inquire`: inquiry capture
- `/stay/[accessCode]`: renter self-service portal
- `/support`: support and maintenance intake
- `/owner`: owner dashboard
- `/admin/setup`: owner setup checklist and missing-fact workflow
- `/admin/listings`: listing draft studio
- `/admin/integrations`: approved/manual/planned integration cockpit
- `/admin/agent-runs`: owner-reviewed agent run ledger
- `/admin/ops`: operating cadence, success criteria, and release gates

## Setup

```bash
npm install
npm run validate
npm run agent:dry-run
npm run typecheck
npm run build
npm run smoke
```

## Data Model

The starter uses repo content in `data/properties.ts` for approved public facts. Runtime submissions are demo-mode only until a database adapter is wired. Production installs should store submissions in a secure database and send only sanitized summaries to GitHub issues.

The first production schema lives in `db/schema.sql`. It separates organizations, properties, units, knowledge articles, listing drafts, inquiries, support tickets, approvals, agent runs, and audit events.

## V1 Safety

- Static portal answers approved facts.
- Forms collect and sanitize demo submissions.
- Availability, rent, lease terms, refunds, urgent repairs, and private data require owner approval.
- No listing channel auto-posting in v1.

## Vercel

Deploy as a normal Next.js project. Use preview deployments for owner review before production.

## Operating Docs

- `docs/operator-runbook.md`
- `docs/portal-scene-brief.md`
- `docs/product-roadmap.md`
- `docs/production-hardening.md`
- `docs/v0-implementation-brief.md`
- `docs/success-criteria.md`
- `docs/taste-standard.md`
- `docs/release-gate.md`
