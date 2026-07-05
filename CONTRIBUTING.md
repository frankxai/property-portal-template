# Contributing

Contributions should improve the portal without weakening the safety model.

## Local Checks

Run before proposing changes:

```bash
npm run validate
npm run typecheck
npm run build
npm run smoke
```

## Rules

- Use sample/public-safe property facts only.
- Keep submissions sanitized in demo mode.
- Do not claim production persistence until a real adapter is implemented.
- Do not add automatic listing posting, renter promises, pricing changes, or lease decisions.
- Do not store secrets or `.env` values.
- Keep UI premium, direct, and operational rather than generic SaaS decoration.
