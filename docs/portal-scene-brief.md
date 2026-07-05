# Portal Scene Brief

## Product Surface

Property Portal Template is the public and authenticated surface for Property Intelligence OS. It must feel like a calm property operations desk: property-first, premium, useful, and explicit about owner approval.

## First Viewport

The first read must answer:

- what property or operating mode is being viewed
- what the renter or owner can do next
- what facts are approved
- what still needs owner review

Avoid generic SaaS hero composition. Real property media and operational state should carry the premium signal.

## Core Scenes

| Route | Scene Job | Premium Signal |
| --- | --- | --- |
| `/` | product cockpit and route selection | clear owner/renter/admin pathways |
| `/properties/[slug]` | public property proof | media, amenities, premium signals, approved facts |
| `/properties/[slug]/inquire` | inquiry capture | no promise of availability or acceptance |
| `/stay/[accessCode]` | renter self-service | approved stay knowledge, clean support paths |
| `/support` | support triage | urgent route visible, owner review explicit |
| `/owner` | weekly owner command desk | decisions, gaps, tickets, listing state |
| `/admin/setup` | onboarding checklist | missing facts before launch |
| `/admin/listings` | channel draft studio | manual/API publication mode and missing facts |
| `/admin/integrations` | integration cockpit | approved paths over unsafe automation |
| `/admin/agent-runs` | agent ledger | source, risk, outcome, owner action |

## Interaction Rules

- Every consequential action returns an owner action.
- Public forms sanitize input and store only demo/runtime-safe records in v1.
- Listing publication, pricing, availability, lease, refund, vendor dispatch, and urgent repair commitments remain owner-approved.
- Admin pages show missing facts instead of pretending the workflow is complete.

## Visual QA Notes

- Desktop should read as dense but calm.
- Mobile should prioritize the next action and avoid squeezed tables.
- No text may overlap property media or status panels.
- Cards frame tools and repeated records only.
- Motion stays local and stateful; no authored scroll set-piece is required for v1.

## Current Score

Target score before public template promotion: 26/30.

Current template intent score: 24/30 pending live desktop/mobile inspection and real property media replacement.
