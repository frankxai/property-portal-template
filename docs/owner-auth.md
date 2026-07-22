# Owner Auth Boundary

The public renter experience stays open. Owner and admin workflows are protected:

- `/owner`
- `/admin/*`
- `/api/runtime/*`
- `/api/implementation/readiness`
- `/api/agent-runs`
- `/api/agent-missions`
- `/api/approved-evidence`
- `/api/agent-drafts`
- `/api/agent-run-reviews`
- `/api/approvals`
- `/api/listing-dry-run`

Public intake remains open:

- `/api/inquiries`
- `/api/support`
- property pages, inquiry pages, renter stay pages, and support page

## Built-in Owner Passcode

The template ships with a no-dependency owner gate so installs fail closed before a full identity provider is added.

Generate a signing secret and passcode hash:

```bash
npm run auth:hash -- "private owner passcode"
```

Set the generated values in Vercel environment variables:

- `OWNER_PORTAL_SECRET`
- `OWNER_PORTAL_PASSCODE_HASH`

Optional automation token for trusted scripts:

- `OWNER_PORTAL_API_TOKEN`

Then call protected APIs with:

```bash
Authorization: Bearer $OWNER_PORTAL_API_TOKEN
```

## Demo Mode

Local development is open when owner auth is not configured. Production is locked unless auth is configured.

To run production smoke tests locally without real secrets:

```env
PROPERTY_OS_DEMO_AUTH=true
```

Never enable demo auth for real renter data.

## Identity Provider Upgrade

For a production SaaS or agency install, replace the passcode gate with Clerk, Descope, Auth0, or another reviewed provider. Keep route-level checks in Server Components and Route Handlers; do not rely only on middleware.
