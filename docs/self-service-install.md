# Self-Service Install Proof

This template is meant to be installed by three groups: a technical property owner, an agency implementation partner, or a managed Property Intelligence OS operator. The install proof packet makes that handoff concrete.

Start in `property-os-template` with `npm run install:plan -- --config <public-safe-config.json>`. Record its source config hash and stable plan hash before configuring Vercel or Railway. That upstream packet is always `planned-not-proven`; this portal's live proof packet supplies target evidence later.

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

1. Generate the schema-valid, secret-free install plan in `property-os-template`.
2. Fork or clone this repository.
3. Run `npm ci`.
4. Run `npm run validate`, `npm run typecheck`, and `npm run build`.
5. Run `npm run install:proof` and review missing env names, missing files, and phase gates.
6. Deploy a private Vercel preview.
7. Replace sample property data only after the owner approves public facts and media rights.

## Owner Preview Path

Before an owner sees the preview, run:

```bash
npm run validate
npm run typecheck
npm run build
npm run smoke
npm run auth:smoke
npm run notification:smoke
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
- create a dedicated portal logical database and role; apply `db/schema.sql`, then `db/rls.sql`, then a private seed
- set `PROPERTY_OS_ORG_ID` for the target organization
- run `npm run db:rls:smoke` against the live database
- create a separate control-plane logical database and role; never point Vercel and Railway at the same logical database
- deploy the Property OS MCP service, set `MCP_SERVER_URL`, `MCP_SERVER_ACCESS_TOKEN`, and `MCP_SERVER_ORIGIN`, and verify its durable `/readyz` state
- apply MCP migrations `001-control-plane.sql` and `002-governed-agent-runtime.sql` in order to the control-plane database
- configure the MCP service model alias and AI Gateway secret on Railway, never in Vercel portal variables
- run `npm run mcp:smoke`; a configured MCP failure must return `503` without local mission, evidence, draft, or review fallback
- register one approved evidence record, run one structured draft by reference, and record one owner review outcome
- apply `db/002-notification-lifecycle.sql` to an existing portal database and rerun RLS proof
- configure signed primary and fallback webhooks plus the scoped notification worker token
- run `npm run notification:smoke`, then archive one deployed urgent delivery, fallback, and owner acknowledgement receipt
- document backups, retention, and deletion ownership
- complete desktop and mobile preview QA
- keep legal, pricing, availability, access, repair, payment, lease, refund, and listing publication decisions under owner approval

Static passcode auth is for a private single-tenant pilot. An agency deployment remains implementation-blocked until OIDC, organization membership, role mapping, session revocation, and access tests are live and proven.

## Business Handoff

The install proof packet supports the offer ladder:

- free community fork for technical owners
- paid owner install for 1 to 10 properties
- agency implementation kit for local real estate operators
- managed Property Intelligence OS retainer for ongoing optimization

The generated install plan and portal proof packet should be attached to every paid handoff. Together they show intended scope, what is live, what needs owner approval, what needs configuration, and which consequential actions are intentionally blocked in v1.
