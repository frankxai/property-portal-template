# Vercel Deployment

## Preview First

Use a protected Vercel preview for owner, privacy, and visual review before production. The repository's deploy link opens Vercel's clone flow; it does not configure identity, databases, notifications, or legal content automatically.

## Production Contract

V0.2 production fails closed unless `PROPERTY_OS_AUTH_MODE` explicitly selects `static-private-pilot` or `oidc`, `DATABASE_URL` is configured, `PROPERTY_OS_ORG_ID` matches the seeded tenant, and the selected identity mode is complete. Inquiry and support intake return `503` without an acceptance receipt when durable storage is unavailable. Demo memory, demo identity, and `sample-stay` are limited to explicit non-production loopback runs.

Use two separate logical Postgres databases and roles:

- Vercel portal database for inquiries, support, renter access, notifications, weekly reviews, portal approvals, and audit
- Railway MCP database for approved evidence, agent missions, structured drafts, owner review, and controlled transitions

Never give either runtime role `SUPERUSER`, `BYPASSRLS`, migration ownership, or the other service's database credential.

## Database Order

Fresh installs apply `db/schema.sql`, then `db/rls.sql`, then an approved private seed. Existing v0.2 databases apply `db/002-notification-lifecycle.sql`, `db/003-weekly-owner-review.sql`, `db/004-tenant-oidc.sql`, and `db/005-renter-access.sql` in order before rerunning `db/rls.sql` and the live database smokes.

## Verification

Before production promotion:

- `npm run validate`
- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `npm run auth:smoke`
- `npm run identity:smoke`
- `npm run identity:db:smoke` for OIDC
- `npm run db:rls:smoke`
- `npm run renter:smoke`
- `npm run notification:smoke`
- `npm run weekly:smoke`
- `npm run install:proof`
- desktop and mobile visual inspection against the exact protected preview

Archive the preview URL, commit, migration receipt, runtime health, tenant-chain equality, negative-auth results, renter-access expiry/revocation proof, notification receipts, visual evidence, rollback owner, and owner acceptance. Local green checks are not a live deployment receipt.
