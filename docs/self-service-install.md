# Self-Service Install Proof

This template is meant to be installed by three groups: a technical property owner, an agency implementation partner, or a managed Property Intelligence OS operator. The install proof packet makes that handoff concrete.

## Proof Surfaces

- `/admin/setup`: owner-facing install checklist with approved property content, command checks, and next actions.
- `/admin/implementation`: implementation readiness across web, runtime, agents, listing channels, notifications, and business packaging.
- `/api/install/proof-packet`: protected JSON contract for partner audits and onboarding automation.
- `npm run install:proof`: local CLI export of the same installation evidence; it does not print secret values.

Use an owner session or trusted automation token for the API:

```bash
curl -H "Authorization: Bearer $OWNER_PORTAL_API_TOKEN" /api/install/proof-packet
```

## 45-Minute Community Fork Path

1. Fork or clone the repository.
2. Run `npm install`.
3. Run `npm run validate`, `npm run typecheck`, and `npm run build`.
4. Run `npm run install:proof` and review missing env names, missing files, and phase gates.
5. Deploy a private Vercel preview.
6. Replace sample property data only after the owner approves public facts and media rights.

## Owner Preview Path

Before an owner sees the preview, run:

```bash
npm run validate
npm run typecheck
npm run build
npm run smoke
npm run auth:smoke
npm run mcp:smoke
npm run install:proof
```

Then review:

- public property page
- inquiry form
- renter portal
- support intake
- owner dashboard
- setup cockpit
- implementation cockpit
- runtime cockpit
- listing draft studio

## Production Path

Production requires more than a green build. The minimum gates are:

- replace all sample property data with approved owner facts
- confirm photo rights and public address policy
- configure `OWNER_PORTAL_SECRET` and `OWNER_PORTAL_PASSCODE_HASH`
- run `npm run auth:hash` for the private owner passcode
- apply `db/schema.sql`, then `db/rls.sql`, then a private seed
- set `PROPERTY_OS_ORG_ID` for the target organization
- run `npm run db:rls:smoke` against the live database
- deploy the Property OS MCP service, set `MCP_SERVER_URL` and `MCP_SERVER_ACCESS_TOKEN`, and verify its durable `/readyz` state
- run `npm run mcp:smoke`; a configured MCP failure must return `503` without local mission fallback
- configure owner notification by email, webhook, or worker
- document backups, retention, and deletion ownership
- complete desktop and mobile preview QA
- keep legal, pricing, availability, access, repair, payment, lease, refund, and listing publication decisions under owner approval

## Business Handoff

The install proof packet supports the offer ladder:

- free community fork for technical owners
- paid owner install for 1 to 10 properties
- agency implementation kit for local real estate operators
- managed Property Intelligence OS retainer for ongoing optimization

The proof packet should be attached to every paid handoff. It shows what is ready, what needs owner approval, what needs configuration, and which consequential actions are intentionally blocked in v1.
