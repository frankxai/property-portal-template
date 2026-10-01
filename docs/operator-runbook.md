# Portal Operator Runbook

The portal is the renter-facing and owner-facing web surface for the Property Intelligence OS.

## Before Editing Content

- confirm which owner workspace is the source of truth
- confirm property facts are approved
- confirm photo rights
- confirm what must stay private

## Local Checks

Run:

```bash
npm run validate
npm run typecheck
npm run build
npm run smoke
npm run auth:smoke
npm run identity:smoke
npm run install:proof
```

The smoke test starts `next start`, verifies the key routes, posts sample inquiry/support payloads, and shuts the server down.
The auth smoke starts `next start` with generated private-pilot credentials and verifies that protected owner/admin APIs reject unauthenticated requests, reject the removed legacy bearer path, enforce request origin, and accept only the owner session.

For a production-mode database install:

```bash
npm run auth:hash -- "private owner passcode"
npm run db:rls:smoke
```

Agency installs also apply `db/004-tenant-oidc.sql`, bind reviewed members, set `PROPERTY_OS_EXPECTED_OIDC_SUBJECTS`, run `npm run identity:db:smoke`, and capture one real IdP callback plus revocation proof in preview.

## Owner Review

Show the owner:

- property page
- inquiry form
- renter portal
- support page
- owner dashboard
- runtime control page
- setup proof cockpit
- listing draft admin
- ops page

## Production Rule

Use a Vercel preview before production when the project is connected to Vercel. Production requires owner approval for copy, media, availability language, urgent support language, owner auth, runtime storage, notification routing, support ownership, the `npm run install:proof` packet, `db/schema.sql`, `db/rls.sql`, a passing `npm run db:rls:smoke`, and the seeded `PROPERTY_OS_ORG_ID`.
