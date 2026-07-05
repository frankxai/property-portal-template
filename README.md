# Property Portal Template

[Deploy on Vercel](https://vercel.com/new/clone?repository-url=https://github.com/frankxai/property-portal-template) ·
[Use this template](https://github.com/frankxai/property-portal-template/generate) ·
[Download ZIP](https://github.com/frankxai/property-portal-template/archive/refs/heads/main.zip) ·
[Operating System Template](https://github.com/frankxai/property-os-template)

Vercel/Next.js template for a premium rental-property website, renter self-service portal, inquiry capture, support intake, owner dashboard, and listing draft admin.

## Who This Is For

- property owners who want a premium renter-facing web experience
- agencies installing modern property websites and support workflows
- implementers who pair Vercel frontends with GitHub-approved property knowledge
- community builders who want a free, safe starting point for AI-assisted property operations

This is the portal half of Property Intelligence OS. Pair it with `property-os-template` for agent roles, MCP boundaries, owner runbooks, partner offer design, and Railway worker architecture.

## Routes

- `/`: operating dashboard entry point
- `/properties/[slug]`: public property page
- `/properties/[slug]/inquire`: inquiry capture
- `/stay/[accessCode]`: renter self-service portal
- `/support`: support and maintenance intake
- `/owner`: owner dashboard
- `/admin/setup`: owner setup checklist and missing-fact workflow
- `/admin/implementation`: installation readiness, agent architecture, production gates, and partner offer ladder
- `/admin/runtime`: runtime storage, notification, capability, and queue posture
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

The starter uses repo content in `data/properties.ts` for approved public facts. Runtime submissions use a demo in-memory store by default and switch to the Postgres adapter when `DATABASE_URL` is configured. Production installs should store submissions in a secure database and send only sanitized summaries to GitHub issues or notification workers.

The first production schema lives in `db/schema.sql`. It separates organizations, properties, units, knowledge articles, listing drafts, inquiries, support tickets, approvals, agent runs, and audit events. Apply `db/rls.sql` after the schema to enable tenant-scoped row-level security, then use `db/seed-sample.sql` for a public-safe local production-mode smoke seed.

Runtime APIs:

- `/api/runtime/health`: environment, adapter, notification, and capability posture
- `/api/runtime/snapshot`: counts, recent demo queue items, audit posture, and production notes

Production database order:

1. Apply `db/schema.sql`.
2. Apply `db/rls.sql`.
3. Seed with `db/seed-sample.sql` or a private owner seed.
4. Set `PROPERTY_OS_ORG_ID` to the seeded organization id.
5. Verify `/admin/runtime` in the deployed preview before real renter data.

## Implementation Cockpit

The route `/admin/implementation` turns the template into an installable product surface. It scores the current install across approved property knowledge, premium portal readiness, runtime storage, Codex/Claude/MCP agent substrate, listing operations, owner notifications, and business packaging.

The API route `/api/implementation/readiness` exposes the same contract for automation, partner audits, and future onboarding flows. It intentionally reports missing environment variables and blocked v1 actions instead of pretending the demo template is production-persistent.

## V1 Safety

- Static portal answers approved facts.
- Forms collect and sanitize demo submissions.
- Availability, rent, lease terms, refunds, urgent repairs, and private data require owner approval.
- No listing channel auto-posting in v1.

## Vercel

Deploy as a normal Next.js project or use the deploy button above after the repository is public. Use preview deployments for owner review before production.

## v0 Path

Use `docs/v0-implementation-brief.md` as the v0 prompt brief for remixing the interface while preserving the safety model: approved facts, human approval, no automatic commitments, and operational dashboard density.

## Operating Docs

- `docs/operator-runbook.md`
- `docs/implementation-cockpit.md`
- `docs/runtime-adapter.md`
- `docs/portal-scene-brief.md`
- `docs/product-roadmap.md`
- `docs/production-hardening.md`
- `docs/v0-implementation-brief.md`
- `docs/success-criteria.md`
- `docs/taste-standard.md`
- `docs/release-gate.md`

## Support Boundary

The public template runs in demo mode until a real database/auth/email adapter is installed. Do not use it with real renter data until production hardening, legal review, monitoring, and owner approval flows are complete.
