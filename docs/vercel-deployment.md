# Vercel Deployment

## Preview First

Use Vercel preview deployments for owner review before production.

## Environment

The v0.1 template runs in demo mode without runtime persistence. Before production forms are used, connect a secure database adapter in `lib/runtime.ts`.

## Verification

Before production:

- `npm run validate`
- `npm run typecheck`
- `npm run build`
- desktop first viewport inspection
- mobile first viewport inspection
- inquiry form test
- support form test
- privacy scan

