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
```

The smoke test starts `next start`, verifies the key routes, posts sample inquiry/support payloads, and shuts the server down.

## Owner Review

Show the owner:

- property page
- inquiry form
- renter portal
- support page
- owner dashboard
- runtime control page
- listing draft admin
- ops page

## Production Rule

Use a Vercel preview before production when the project is connected to Vercel. Production requires owner approval for copy, media, availability language, urgent support language, runtime storage, notification routing, and support ownership.
