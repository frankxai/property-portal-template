# Production Hardening

## Security

- Use authenticated owner/admin routes before real data.
- Set `PROPERTY_OS_AUTH_MODE` explicitly. Production locks when the mode is absent, invalid, or incomplete, and demo auth cannot open a production build.
- Use `static-private-pilot` only for one trusted owner. Agencies use the implemented pre-bound OIDC mode in `docs/owner-auth.md`.
- Do not add a portal-wide owner bearer. Browser operations use revocable sessions; machine agent operations use the governed MCP identity boundary.
- Pin Better Auth and its database schema version. Run signed-token negative tests and a real-provider callback test before agency activation.
- Bind every authorized member by reviewed issuer/subject, email, organization, and one role. IdP claims never create or elevate local membership.
- Use a dedicated `NOSUPERUSER NOBYPASSRLS` runtime database role that does not own RLS tables; reserve schema changes and member binding for a separate migration role.
- Connect IdP deprovisioning to atomic local membership/session revocation or document a manual SLA within the fixed one-hour OIDC session ceiling.
- Store inquiries, support tickets, approvals, and agent runs in a tenant-scoped database.
- Fail production intake closed when durable storage is absent. Demo memory is admitted only in development or an explicit loopback test, and paired intake/approval records commit atomically before notification.
- Apply `db/rls.sql` after `db/schema.sql` so Postgres enforces tenant isolation through `property_os.organization_id`.
- Route agent missions, approved evidence, structured drafts, and owner review outcomes through the authenticated MCP service. Never fall back to portal persistence after a configured MCP failure.
- Keep model keys and model aliases in the Railway MCP service. The Vercel portal receives only MCP transport credentials.
- Disable the manual demo agent-run ledger in production; model output must have a mission, frozen evidence hashes, policy result, and review state.
- Use `/admin/runtime` to verify adapter, notification, capability, queue, and audit posture.
- Keep `OWNER_NOTIFICATION_WEBHOOK_URL` payloads sanitized and route full private details only through runtime storage.
- Keep access codes, private addresses, lease details, IDs, bank data, and payment records out of public content.
- Sanitize all form input and send only sanitized summaries to GitHub or external tools.
- Record audit events for approval changes, agent drafts, support triage, and listing publication attempts.
- Use separate preview and production environments.

## Performance

- Keep the first public property page lightweight.
- Optimize property media before launch.
- Avoid heavy dashboard code on renter-facing routes.
- Prefer server-rendered approved facts and small client forms.
- Add image dimensions and responsive constraints before replacing sample media.
- Keep third-party scripts out of v1 unless they have a clear owner or renter job.

## Reliability

- Forms must return a route and owner action.
- Forms must return persistence and owner-notification receipts.
- Urgent support must not depend on generative output.
- Failed runtime writes return an unavailable state and must not trigger owner notification or claim that renter input was accepted.
- Integrations must ship with dry-run mode before live writes.
- Manual owner workflow must remain possible if email, database, or integration services fail.

## Design

- First viewport shows the property or operating state, not generic SaaS decoration.
- Mobile layout gets its own composition.
- Owner-review states are visible.
- Missing facts are shown instead of hidden.
- Real, rights-approved property media is required before public launch.
- No text overlap, clipped buttons, or hidden urgent support path.

## Setup

Before production:

1. Wire runtime database.
2. Apply `db/schema.sql`.
3. Apply `db/rls.sql`.
4. Seed `organizations` and `properties` for `PROPERTY_OS_ORG_ID`.
5. Select the explicit private-pilot or agency OIDC mode; for OIDC, apply `db/004-tenant-oidc.sql` and pre-bind reviewed members.
6. Run `npm run identity:smoke`, `npm run db:rls:smoke`, and, for OIDC, `npm run identity:db:smoke` against the target runtime role.
7. Prove a real OIDC callback, foreign-member denial, role denial, sign-out, revocation, and expiry in preview when agency mode is selected.
8. Configure `MCP_SERVER_URL` and its tenant-bound credential, verify durable `/readyz`, and run `npm run mcp:smoke` across mission, evidence, draft, and review tools.
9. Wire sanitized owner notification webhook or worker.
10. Replace sample content and media.
11. Run validation, privacy, typecheck, build, smoke, and visual QA.
12. Verify Vercel preview.
13. Review owner approval routes and record residual risks.
