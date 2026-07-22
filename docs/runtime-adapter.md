# Runtime Adapter

The portal ships with two runtime modes:

- `demo-memory`: default mode for community forks, local tests, and screenshots.
- `postgres`: production path activated by `DATABASE_URL`.

The switch is automatic and visible through `/api/runtime/health`, `/api/runtime/snapshot`, and `/admin/runtime`.

Agent missions have an additional authoritative path. When both `MCP_SERVER_URL` and `MCP_SERVER_ACCESS_TOKEN` are configured, `/api/agent-missions` writes through the authenticated MCP control plane. The portal does not duplicate that write in its local adapter. A partial configuration or failed MCP request returns `503` before notification or downstream work; there is no silent production fallback.

## Demo Memory

Demo memory stores sanitized runtime summaries only inside the current Node process. It is useful for:

- local smoke tests
- Vercel preview review without real renter data
- explaining owner approval workflows
- partner demos

It is not durable and must not be used as production storage.

## Postgres Runtime

Production installs should:

1. create a managed Postgres logical database and least-privilege runtime role dedicated to the portal
2. apply `db/schema.sql`
3. apply `db/rls.sql`
4. seed `organizations` and approved `properties`
5. set `PROPERTY_OS_ORG_ID`
6. set `DATABASE_URL`
7. configure `OWNER_PORTAL_SECRET` and `OWNER_PORTAL_PASSCODE_HASH`
8. run `npm run db:rls:smoke`
9. configure the MCP endpoint, origin, and access token backed by a separate control-plane logical database, then run `npm run mcp:smoke`
10. verify `/admin/runtime` and `/api/runtime/snapshot` from an owner session

Existing databases also apply `db/002-notification-lifecycle.sql` and `db/003-weekly-owner-review.sql` in order, rerun `db/rls.sql`, and rerun the live RLS smoke.

The adapter writes:

- inquiries to `inquiries`
- support items to `support_tickets`
- approvals to `approvals`
- agent runs to `agent_runs`
- agent missions, approved evidence, structured model runs, resource versions, approval receipts, and controlled transitions through the MCP service and its separate database
- listing dry-runs and write traces to `audit_events`
- weekly review timing, decisions, and metric observations to `weekly_owner_reviews` and `weekly_metric_observations`

Private renter messages, emails, and support details belong only in runtime storage. Public repos and GitHub issues receive sanitized summaries.

The portal and MCP currently own different ledgers. Their `DATABASE_URL` values must never target the same logical database. The authenticated MCP API is the only data and authority bridge between them.

## Tenant Isolation

`db/rls.sql` enables row-level security on all runtime tables and defines policies around `property_os.organization_id`.

The app sets that tenant context inside each Postgres transaction before runtime writes or runtime snapshot reads:

```sql
select set_config('property_os.organization_id', '<PROPERTY_OS_ORG_ID>', true);
```

This does not replace application auth. It gives implementers a database-level tenant boundary so a future owner or agency install can move toward multi-owner operation without relying only on application filters.

Install order:

1. Run `db/schema.sql`.
2. Run `db/rls.sql`.
3. Run `db/seed-sample.sql` for local production-mode smoke tests, or apply a private owner seed.
4. Set `PROPERTY_OS_ORG_ID` to the seeded organization id.
5. Configure owner auth.
6. Run `npm run db:rls:smoke`.
7. Confirm `/api/runtime/snapshot` returns counts for only that organization from an owner session.

## Owner Notifications

Notifications use a transactional outbox inside the portal database and a scoped delivery worker. Intake writes the sanitized notification and payload hash before any provider request. The worker owns signed delivery, bounded retry, urgent fallback, and acknowledgement timeout processing.

Environment:

- `OWNER_NOTIFICATION_WEBHOOK_URL` and `OWNER_NOTIFICATION_WEBHOOK_SIGNING_SECRET`: signed primary owner route
- `OWNER_NOTIFICATION_FALLBACK_WEBHOOK_URL` and `OWNER_NOTIFICATION_FALLBACK_SIGNING_SECRET`: separately signed urgent fallback route
- `OWNER_NOTIFICATION_WORKER_TOKEN`: scoped queue-processing credential
- `OWNER_NOTIFICATION_WEBHOOK_URL`: optional webhook for n8n, Make, Railway worker, or email service bridge
- `OWNER_NOTIFICATION_WEBHOOK_SIGNING_SECRET`: HMAC key for the primary receiver
- `OWNER_NOTIFICATION_FALLBACK_WEBHOOK_URL`: separate urgent fallback receiver
- `OWNER_NOTIFICATION_FALLBACK_SIGNING_SECRET`: HMAC key for the fallback receiver
- `OWNER_NOTIFICATION_WORKER_TOKEN`: scoped bearer accepted only by `/api/notifications/process`

Webhook payloads include only:

- source id
- kind
- urgency
- route
- sanitized summary
- owner action
- timestamp
- payload hash and protected acknowledgement URL

They do not include access secrets, payment data, private addresses, identity documents, lease details, or full renter messages.

Use `/admin/notifications` to inspect delivery evidence and acknowledge an item. Acknowledgement stops retries and records an append-only event; it never sends a reply or dispatches work. See `docs/notification-lifecycle.md`.

## Weekly Owner Evidence

`/admin/ops` starts one server-timestamped review per organization and UTC week. Completion atomically stores the owner's bounded inputs, Keep / Change / Stop decisions, five metric observations, and an audit event. A repeated completion returns the original evidence instead of rewriting history.

The urgent acknowledgement metric uses the slowest acknowledged urgent notification created inside the review window. With no qualifying receipt it remains `unmeasured`. The zero unauthorized-action metric is a policy observation over the portal's governed action surface only; it is not telemetry for disconnected tools. See `docs/weekly-owner-review.md`.

## Production Gates

Do not put real renter data through the portal until:

- Postgres writes are verified
- auth and owner/admin role checks exist
- `npm run db:rls:smoke` passes against the target database
- the deployed MCP `/readyz` reports durable Postgres state and the portal-to-MCP mission flow passes
- row-level security policies are applied
- retention and deletion policy is defined
- backups are enabled
- owner notification failure path is tested
- `npm run notification:smoke` passes and the deployed primary/fallback provider receipts are archived
- `npm run weekly:smoke` passes and one owner-reviewed live observation packet is archived
- Vercel preview is reviewed
- support ownership is explicit

The runtime adapter is a production path, not a legal/compliance substitute.
