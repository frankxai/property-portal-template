# Property Portal Agent Instructions

These instructions apply inside this Next.js portal template.

## Purpose

Build and maintain a premium renter and owner web portal for the Property Intelligence OS.

## Premium Web OS

Use the estate Premium Web OS for visual, motion, and public UI work:

- real property evidence before abstract visuals
- calm premium interface, not generic SaaS
- first viewport shows the product state
- mobile composed intentionally
- no invented property claims
- visual QA before handoff

## Privacy

Never commit:

- renter names tied to addresses, payment, complaints, or lease terms
- identity documents
- bank details, IBANs, deposits, or payment records
- access codes, lockbox codes, alarm codes, Wi-Fi passwords, or utility account numbers
- private owner financials
- exact private addresses unless explicitly approved
- secrets or `.env` values

## Implementation Rules

- Use `data/properties.ts` only for public-safe sample facts.
- Keep runtime submission logic behind `lib/runtime.ts`.
- Do not add scraping or auto-posting.
- Do not claim production database persistence until a real adapter is implemented.
- Verify with `npm run validate`, `npm run typecheck`, and `npm run build`.

