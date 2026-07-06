# Template Readiness

## Audience

- landlords and family property operators
- boutique real estate agencies
- implementation partners selling premium renter portals
- builders exploring AI-assisted property operations

## Template Type

Vercel/Next.js portal template paired with a GitHub-approved property knowledge workspace.

## Buyer Outcome

Deploy a polished property website, renter self-service portal, inquiry/support intake, owner dashboard, listing draft studio, integration cockpit, and agent-run ledger.

## Deploy Target

- Vercel for the web portal
- GitHub for template source, forks, issues, releases, and sample content
- secure database/auth/storage/email adapters for production installs

## Monetization Path

- free community template
- paid implementation service
- managed support and owner review subscription
- premium adapter bundle
- future Vercel/v0 remix package

## Required Before Production

- replace sample property data with approved owner facts
- wire database/auth/email/storage
- configure `OWNER_PORTAL_SECRET` and `OWNER_PORTAL_PASSCODE_HASH`
- run `npm run install:proof` and attach the proof packet to the owner or partner handoff
- run `npm run db:rls:smoke` against the target database
- configure owner notification
- add privacy policy and local legal review
- run preview QA on real photos and mobile
- confirm no exact private address is published without approval

## Publish Action

1. Push this repo as `frankxai/property-portal-template`.
2. Mark it as a GitHub template.
3. Create release `v0.1.0`.
4. Verify the Vercel deploy button.
5. Link it from the FrankX Property Intelligence OS page.
