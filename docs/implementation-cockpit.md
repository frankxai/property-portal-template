# Implementation Cockpit

`/admin/implementation` is the install control surface for the portal template. It exists so a property owner, agency, or AI implementer can see the difference between a safe public fork and a production install.

## What It Proves

- the public portal is ready to deploy and customize
- runtime submissions are demo-mode until storage, auth, and notification adapters exist
- Codex, Claude, MCP, and owner approvals are part of the product architecture, not hidden consultant notes
- listing publication stays manual until API access, channel terms, and error recovery are approved
- the same template supports a free community path and paid implementation packages

## Readiness API

Use an authenticated owner browser session. The portal does not expose a global owner automation bearer; local automation uses `npm run install:proof`, and agent automation crosses the governed MCP boundary.

The response includes:

- `score`: install readiness percentage
- `runtimeMode`: `demo` or `database-ready`
- `missingEnv`: environment names still needed before production
- `blockedV1Actions`: consequential actions intentionally blocked in v1
- `layers`: owner value, implementer action, evidence, and production gate per layer
- `partnerOffers`: free fork, owner install, agency kit, and managed OS offer ladder

## Install Proof Packet

Use `/api/install/proof-packet` when the handoff needs an auditable owner or partner proof packet. It includes install phases, command checks, owner approval requirements, blocked v1 actions, runtime posture, and public safety boundaries.

```bash
npm run install:proof
```

The route and CLI report environment key names and configured booleans only. They do not print secret values.

## Partner Delivery Standard

An implementation partner should not sell the public template as production-ready by itself. A paid install must include:

1. approved property facts, media rights, and public address policy
2. Vercel preview verification on desktop and mobile
3. secure database, explicit owner auth mode, identity/RLS smoke evidence, backups, and retention policy
4. owner notification route for urgent and approval-required items
5. private client workspace for sensitive property/renter operations
6. Codex/Claude/MCP setup with approved-facts-only boundaries
7. human approval for pricing, availability, leases, refunds, urgent repairs, vendor dispatch, renter-facing messages, access information, and listing publication

## Offer Ladder

- Free community fork: safe starter and learning artifact.
- Done-with-you owner install: setup fee plus optional review retainer.
- Agency implementation kit: license, install fee, and support retainer.
- Managed Property Intelligence OS: monthly operations subscription.

The free template creates trust. Paid work should sell speed, judgment, privacy, media quality, legal-safe workflows, and ongoing optimization.

## Production Exit Criteria

The cockpit can show a high readiness score before the install is legally or operationally production-ready. Production exit still requires owner approval, private-data review, auth review, database checks including `npm run db:rls:smoke`, visual QA, and a Vercel preview.
