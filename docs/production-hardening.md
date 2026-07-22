# Production Hardening

## Security

- Use authenticated owner/admin routes before real data.
- Configure the built-in owner passcode gate with `OWNER_PORTAL_SECRET` and `OWNER_PORTAL_PASSCODE_HASH`, or replace it with a reviewed identity provider.
- Keep `PROPERTY_OS_DEMO_AUTH=false` in production.
- Use `OWNER_PORTAL_API_TOKEN` only for trusted server-to-server automation and rotate it when an implementer leaves.
- Store inquiries, support tickets, approvals, and agent runs in a tenant-scoped database.
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
- Failed runtime writes should show owner-visible failure state.
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
5. Configure owner auth with `npm run auth:hash -- "private owner passcode"` or a reviewed identity provider.
6. Run `npm run db:rls:smoke` against the target database.
7. Configure `MCP_SERVER_URL` and `MCP_SERVER_ACCESS_TOKEN`, verify durable `/readyz`, and run `npm run mcp:smoke` across mission, evidence, draft, and review tools.
8. Wire sanitized owner notification webhook or worker.
9. Replace sample content and media.
10. Run validation, privacy, typecheck, build, smoke, and visual QA.
11. Verify Vercel preview.
12. Review owner approval routes.
13. Record residual risks.
