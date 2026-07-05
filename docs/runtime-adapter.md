# Runtime Adapter

The portal ships with two runtime modes:

- `demo-memory`: default mode for community forks, local tests, and screenshots.
- `postgres`: production path activated by `DATABASE_URL`.

The switch is automatic and visible through `/api/runtime/health`, `/api/runtime/snapshot`, and `/admin/runtime`.

## Demo Memory

Demo memory stores sanitized runtime summaries only inside the current Node process. It is useful for:

- local smoke tests
- Vercel preview review without real renter data
- explaining owner approval workflows
- partner demos

It is not durable and must not be used as production storage.

## Postgres Runtime

Production installs should:

1. create a managed Postgres database
2. apply `db/schema.sql`
3. seed `organizations` and approved `properties`
4. set `PROPERTY_OS_ORG_ID`
5. set `DATABASE_URL`
6. add auth and role checks before real owner/admin use
7. verify `/admin/runtime` and `/api/runtime/snapshot`

The adapter writes:

- inquiries to `inquiries`
- support items to `support_tickets`
- approvals to `approvals`
- agent runs to `agent_runs`
- listing dry-runs and write traces to `audit_events`

Private renter messages, emails, and support details belong only in runtime storage. Public repos and GitHub issues receive sanitized summaries.

## Owner Notifications

Notifications are intentionally separate from storage.

Environment:

- `OWNER_NOTIFICATION_EMAIL`: owner target, used for setup and future email worker routing
- `OWNER_NOTIFICATION_WEBHOOK_URL`: optional webhook for n8n, Make, Railway worker, or email service bridge

Webhook payloads include only:

- source id
- kind
- urgency
- route
- sanitized summary
- owner action
- timestamp

They do not include access secrets, payment data, private addresses, identity documents, lease details, or full renter messages.

## Production Gates

Do not put real renter data through the portal until:

- Postgres writes are verified
- auth and owner/admin role checks exist
- retention and deletion policy is defined
- backups are enabled
- owner notification failure path is tested
- Vercel preview is reviewed
- support ownership is explicit

The runtime adapter is a production path, not a legal/compliance substitute.
