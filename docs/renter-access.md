# Renter access grants

Renter portal links use a server-generated 32-byte base64url code. The API returns the plaintext code only in the successful creation response; PostgreSQL stores only its SHA-256 digest. Audit rows contain the grant id, actor, property/unit references, expiry, and lifecycle event, never the code or digest.

## Database

Fresh installs apply `db/schema.sql` and `db/rls.sql`. Existing v0.2 databases apply `db/005-renter-access.sql` with the migration role, then rerun `db/rls.sql`. The runtime role must remain `NOSUPERUSER NOBYPASSRLS` and must not own RLS tables.

Every grant is bound to `PROPERTY_OS_ORG_ID` and a property. An optional unit is protected by a composite unit/property foreign key. Public resolution selects only the property display name and approved renter articles where `contains_private_data = false`; it does not select private addresses, unit names, or tenant records.

## Owner API

`POST /api/renter-access` accepts `propertyId`, optional `unitId`, optional `rentalLabel`, and an ISO `expiresAt` between five minutes and 180 days in the future. It requires the dedicated `renter-access:create` capability, which the current policy grants to owners, agency admins, and managers.

`POST /api/renter-access/{grantId}/revoke` requires the separate `renter-access:revoke` capability, which the current policy grants only to owners and agency admins. Neither route makes lease, pricing, legal, physical-entry, messaging, or external-system commitments.

## Runtime behavior

`/stay/{accessCode}` returns the same not-found response for malformed, missing, expired, revoked, cross-tenant, throttled, and storage-error cases. Successful access emits a minimal audit event with no request address, raw code, or digest. Lookup throttling is process-local and intended as a basic abuse brake; production edge/WAF rate limiting remains recommended for distributed deployments.

`sample-stay` is available only when all of these are true: `NODE_ENV` is not `production`, `PROPERTY_OS_DEMO_RUNTIME=true`, and `APP_BASE_URL` is loopback. Production without `DATABASE_URL` fails closed.
