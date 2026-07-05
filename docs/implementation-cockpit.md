# Implementation Cockpit

`/admin/implementation` is the install control surface for the portal template. It exists so a property owner, agency, or AI implementer can see the difference between a safe public fork and a production install.

## What It Proves

- the public portal is ready to deploy and customize
- runtime submissions are demo-mode until storage, auth, and notification adapters exist
- Codex, Claude, MCP, and owner approvals are part of the product architecture, not hidden consultant notes
- listing publication stays manual until API access, channel terms, and error recovery are approved
- the same template supports a free community path and paid implementation packages

## Readiness API

Use:

```bash
curl /api/implementation/readiness
```

The response includes:

- `score`: install readiness percentage
- `runtimeMode`: `demo` or `database-ready`
- `missingEnv`: environment names still needed before production
- `blockedV1Actions`: consequential actions intentionally blocked in v1
- `layers`: owner value, implementer action, evidence, and production gate per layer
- `partnerOffers`: free fork, owner install, agency kit, and managed OS offer ladder

## Partner Delivery Standard

An implementation partner should not sell the public template as production-ready by itself. A paid install must include:

1. approved property facts, media rights, and public address policy
2. Vercel preview verification on desktop and mobile
3. secure database, auth, backups, and retention policy
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

The cockpit can show a high readiness score before the install is legally or operationally production-ready. Production exit still requires owner approval, private-data review, auth review, database checks, visual QA, and a Vercel preview.
