# Owner Identity Boundary

Public property, inquiry, stay, and support surfaces remain open. Owner pages and operational APIs require a revocable browser session. The portal does not accept a global owner API bearer.

## Explicit Modes

`PROPERTY_OS_AUTH_MODE` is mandatory in every production runtime. Missing, unsupported, incomplete, or invalid configuration locks owner access; one mode never falls back to the other.

| Mode | Intended use | Authority |
| --- | --- | --- |
| `static-private-pilot` | one trusted owner, private pilot | owner only |
| `oidc` | agency or multi-user install | pre-bound owner, agency-admin, or manager |

`PROPERTY_OS_DEMO_AUTH=true` works only with `next dev` outside production and only when no auth mode is selected. It cannot open a production build.

## Private Pilot

Generate a 32-byte signing secret and passcode digest:

```bash
npm run auth:hash -- "private owner passcode"
```

Set `PROPERTY_OS_AUTH_MODE=static-private-pilot`, canonical public HTTPS `APP_BASE_URL`, `OWNER_PORTAL_SECRET`, and `OWNER_PORTAL_PASSCODE_HASH`. The canonical origin is mandatory for mutation CSRF checks and is never inferred from an incoming production request. The signed HttpOnly cookie lasts eight hours. Passcode attempts are bounded in-process; keep this mode private and network-restricted. It is not the agency identity model. Production-bundle tests use an internal explicit localhost flag and always report `productionSafe: false`.

## Agency OIDC

Agency mode uses Better Auth `1.6.23`, Authorization Code plus PKCE, RFC 9207 response-issuer validation, pinned authorization/token/JWKS endpoints, signed ID-token validation, PostgreSQL rate limits, and database sessions. ID tokens must pass signature, exact issuer, audience, authorized-party, algorithm, age, and expiry checks.

Required configuration:

- `DATABASE_URL`, `APP_BASE_URL`, and a 32-byte base64url `BETTER_AUTH_SECRET`
- `PROPERTY_OS_ORG_ID`
- `PROPERTY_OS_OIDC_ISSUER`
- `PROPERTY_OS_OIDC_AUTHORIZATION_URL`
- `PROPERTY_OS_OIDC_TOKEN_URL`
- `PROPERTY_OS_OIDC_JWKS_URL`
- `PROPERTY_OS_OIDC_CLIENT_ID` and `PROPERTY_OS_OIDC_CLIENT_SECRET`

The issuer and three provider endpoints must be HTTPS, use public hosts, have no embedded credentials or fragments, and share the issuer origin. Private or reserved identity endpoints fail configuration. Preview and production use separate fixed origins and IdP clients.

### Pre-Bound Membership

The IdP cannot create or elevate a Property OS member. Before first sign-in, a database owner reviews the person's organization, email, immutable issuer/subject, and one role, then calls:

```sql
select property_os_bind_oidc_member(
  'organization-id',
  'reviewed-owner@example.com',
  'https://identity.example.com/tenant',
  'immutable-provider-subject',
  'owner'
);
```

The function upgrades only a matching active member, refuses rebinding, and is revoked from `PUBLIC`. Unbound legacy rows cannot sign in. The callback also requires verified email, one exact organization claim, one recognized role claim, exact local email, and exact local role. Ambiguous organizations or roles are denied.

### Roles

- `owner` and `agency-admin`: read, operate, decide agent-review outcomes, and revoke identity memberships.
- `manager`: read and operate, but cannot decide governed reviews or revoke identities.

Each protected route declares a capability. Consequential renter, listing, pricing, availability, lease, refund, access, and dispatch actions remain separately owner-gated.

### Sessions And Revocation

OIDC sessions are server-backed, cookie caching is disabled, and authorization rechecks the active local membership on every request. Sessions have a fixed one-hour ceiling and do not slide. Database-backed rate limiting works across serverless instances.

An owner or agency admin can call `POST /api/admin/members/revoke` with `{ "subject": "..." }`. The transaction marks the membership revoked and deletes every matching session before commit. Production operators must connect IdP deprovisioning to this action or document a manual revocation SLA no longer than the one-hour session ceiling.

## Database Boundary

The portal database is one organization deployment boundary. Better Auth protocol tables are not tenant-RLS tables, so do not share one portal logical database across unrelated organizations. `DATABASE_URL` must use a dedicated `NOSUPERUSER NOBYPASSRLS` runtime role that does not own RLS tables. Schema changes run with a separate migration role.

Apply `db/004-tenant-oidc.sql` transactionally to existing databases, then rerun `db/rls.sql`. The migration records schema version `1.6.23-property-os.1`, checks required columns, and refuses duplicate organization/issuer/subject bindings.

## Proof Gates

```bash
npm run auth:smoke
npm run identity:smoke
npm run db:rls:smoke
npm run identity:db:smoke
```

`identity:smoke` proves the local policy, role matrix, signed-token negatives, and pinned migration contract. The database smokes require the target runtime database; set `PROPERTY_OS_EXPECTED_OIDC_SUBJECTS` to the reviewed comma-separated subjects. Production promotion additionally requires one real IdP callback, sign-out, denied foreign member, revoked member, and session-expiry test in the Vercel preview.

The local verifier is implemented and tested. A real provider callback and deployed Postgres/RLS proof remain deployment evidence, not template claims.
