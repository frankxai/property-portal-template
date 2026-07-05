# v0 Implementation Brief

## Goal

Generate or refine a Vercel-ready Next.js App Router portal for Property Intelligence OS.

## Required Routes

- `/`
- `/properties/[slug]`
- `/properties/[slug]/inquire`
- `/stay/[accessCode]`
- `/support`
- `/owner`
- `/admin/setup`
- `/admin/listings`
- `/admin/integrations`
- `/admin/agent-runs`
- `/admin/ops`

## Required APIs

- `/api/runtime/health`
- `/api/inquiries`
- `/api/support`
- `/api/agent-runs`
- `/api/listing-dry-run`
- `/api/approvals`

## Design Brief

The page should feel like a premium property operating desk, not a generic SaaS dashboard.

Rules:

- property or operating state is the first signal
- owner-review states are visible
- missing facts are shown
- support and urgent paths are clear
- renter-facing routes stay lightweight
- mobile gets its own composition
- no access, payment, lease, or private renter data in static content

## Acceptance

- `npm run validate`
- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- hosted desktop and mobile visual QA before public release
