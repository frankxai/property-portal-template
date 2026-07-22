# Portal Release Gate

Before preview:

- `npm run validate`
- `npm run typecheck`
- `npm run build`
- `npm run smoke`
- `npm run auth:smoke`
- `npm run identity:smoke`
- `npm run visual:qa`
- `npm run audit`
- `npm run install:proof`

Before production:

- property facts owner-approved
- listing copy owner-approved
- urgent support language owner-approved
- private data scan clear
- media rights confirmed
- desktop and mobile visually reviewed
- no sample-only wording remains unless intentionally marked
- Vercel preview inspected
- control-center mission create flow inspected and persistence mode understood
- production Postgres schema and RLS reapplied for v0.2 control tables
- explicit auth mode selected; agency installs have pre-bound membership, pinned endpoints, real IdP callback/revocation evidence, and passing identity database smoke
- runtime database role is `NOSUPERUSER NOBYPASSRLS` and does not own tenant RLS tables
- Railway MCP OIDC, Origin allowlist, health, readiness, and authority tests verified if hosted MCP is enabled

Blocked release examples:

- unapproved rent or availability
- access code in repo content
- private renter information in GitHub
- broken inquiry or support form
- text overlap on mobile
- generic imagery for a real property launch
- missing auth mode, unbound agency member, ambiguous IdP role, global owner bearer, or unproven real-provider callback
