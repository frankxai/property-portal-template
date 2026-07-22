# Owner Notification Lifecycle

## Outcome

Urgent owner escalation is a receipt-backed operating loop, not an email field. The portal records a sanitized transactional outbox item before delivery. A scoped worker claims due jobs with a lease, sends an HMAC-signed webhook, retries boundedly, invokes a separate fallback route when an urgent delivery is not acknowledged, and records owner acknowledgement idempotently.

This lifecycle never replies to a renter, dispatches a vendor, reveals access details, applies model content, or makes a property commitment.

## State Model

`queued -> processing -> sent -> acknowledged`

Failure and fallback states:

- `failed`: primary delivery failed and is either waiting for its bounded retry or exhausted.
- `fallback-required`: an urgent item has no viable primary route, exhausted primary attempts, or exceeded its acknowledgement deadline.
- `fallback-sent`: the signed fallback webhook accepted the sanitized envelope.
- `fallback-failed`: the fallback attempt failed and is either waiting for its bounded retry or exhausted.

`notification_deliveries` stores the current state. `notification_events` is append-only lifecycle evidence. Both tables use forced tenant RLS. Provider URLs, signing secrets, target addresses, private renter messages, and access information are never stored in either table.

## Delivery Contract

The webhook body uses `property-os.ownerNotification.v1` and includes only:

- notification and source IDs
- kind, urgency, route, sanitized summary, and owner action
- payload SHA-256
- creation time and protected acknowledgement URL
- `contentApplied: false`
- an empty `externalActionsPerformed` list

Headers include an idempotency key, ISO timestamp, event name, and `v1=` HMAC-SHA256 signature over `<timestamp>.<raw-body>`. Receivers must verify the signature against the raw body before parsing and deduplicate on the idempotency key. Redirects are rejected. HTTPS is mandatory outside localhost.

## Environment

Required for primary delivery:

- `OWNER_NOTIFICATION_WEBHOOK_URL`
- `OWNER_NOTIFICATION_WEBHOOK_SIGNING_SECRET` with at least 24 characters
- `OWNER_NOTIFICATION_WORKER_TOKEN`
- `APP_BASE_URL`

Required for fallback delivery:

- `OWNER_NOTIFICATION_FALLBACK_WEBHOOK_URL`
- `OWNER_NOTIFICATION_FALLBACK_SIGNING_SECRET` with at least 24 characters

Bounded policy overrides:

- `OWNER_NOTIFICATION_MAX_ATTEMPTS` defaults to 3, range 1-5
- `OWNER_NOTIFICATION_RETRY_BASE_MS` defaults to 60000, range 1000-900000
- `OWNER_NOTIFICATION_ACK_TIMEOUT_MS` defaults to 300000, range 1000-86400000
- `OWNER_NOTIFICATION_CLAIM_LEASE_MS` defaults to 30000, range 5000-300000
- `OWNER_NOTIFICATION_REQUEST_TIMEOUT_MS` defaults to 6000, range 1000-15000
- `OWNER_NOTIFICATION_BATCH_SIZE` defaults to 10, range 1-25

Store every secret only in the appropriate host secret manager.

## Worker

Call the scoped endpoint from one Railway worker or approved scheduler:

```bash
curl -X POST \
  -H "Authorization: Bearer $OWNER_NOTIFICATION_WORKER_TOKEN" \
  "$APP_BASE_URL/api/notifications/process"
```

Run one worker every 30-60 seconds for the five-minute urgent acknowledgement hypothesis. The SQL claim uses `FOR UPDATE SKIP LOCKED`, a bounded batch, and a recovery lease to prevent parallel duplicate work and recover abandoned claims. Keep only one configured scheduler in the first pilot.

## Owner Surface

`/admin/notifications` is protected by owner auth. It shows status, urgency, primary and fallback attempt counts, delivery and acknowledgement times, the sanitized owner action, and payload hash. `Acknowledge` records evidence and cancels pending retries; it performs no other action.

`GET /api/notifications` is owner-protected. `POST /api/notifications/[id]/acknowledge` is owner-protected and idempotent. `POST /api/notifications/process` accepts only `OWNER_NOTIFICATION_WORKER_TOKEN`; the owner API token cannot invoke it.

## Proof

After a production build, run:

```bash
npm run notification:smoke
```

The smoke test starts isolated primary and fallback receivers and proves scoped-worker denial, outbox-before-send, HMAC signatures, private-message exclusion, primary delivery, urgent timeout fallback, idempotent acknowledgement, standard retry after HTTP 503, stable payload hashes, and zero downstream actions.

Live acceptance still requires provider receipts and owner acknowledgement from the deployed environment. A local mock pass is not delivery evidence.
