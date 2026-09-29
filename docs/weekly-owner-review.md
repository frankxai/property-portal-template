# Weekly Owner Review

The protected `/admin/ops` review is the measurable operating loop for a property install. It replaces retrospective claims with server-timestamped evidence and an explicit Keep / Change / Stop decision.

## Evidence Contract

Starting a review records one `weekly_owner_reviews` row for the organization and UTC week. Repeated starts return the same row. Completion is also idempotent and records exactly five `weekly_metric_observations`:

| Metric | Target | Source | Unmeasured when |
| --- | --- | --- | --- |
| Owner review time | 30 minutes or less | server timestamps | never after completion |
| Repeated questions covered | 70 percent or more | owner-entered counts | no repeated questions were recorded |
| Listing ready before vacancy | 30 days or more | owner-entered dates | the paired dates are omitted |
| Urgent owner acknowledgement | under 5 minutes | notification ledger | no acknowledged urgent item exists in the review window |
| Unauthorized external actions | zero | governed product policy | not applicable to disconnected tools |

`unmeasured` is a first-class status. It must not be presented as success or failure. The unauthorized-action observation covers only the product's governed action surface: publication, renter messaging, vendor dispatch, pricing or availability changes, and lease or legal commitments. It does not claim visibility into manual owner activity or disconnected systems.

## Storage And Authority

- `weekly_owner_reviews` stores the current review and owner decisions.
- `weekly_metric_observations` stores one immutable-by-workflow observation per metric and completed review.
- Both tables use forced tenant RLS and the scoped organization transaction context.
- Start and completion emit `weekly_review.started` and `weekly_review.completed` audit events.
- Completion sends no renter message, publishes no listing, changes no content, and dispatches no vendor.
- Keep / Change / Stop notes are private runtime data and must never be copied into public GitHub issues without sanitization and owner approval.

## Existing Database Upgrade

Apply in order:

```bash
# Apply db/003-weekly-owner-review.sql with the approved database migration tool.
# Then rerun the full tenant policy file and live proof.
npm run db:rls:smoke
```

Fresh databases receive the tables through `db/schema.sql` followed by `db/rls.sql`.

## Release Proof

```bash
npm run build
npm run weekly:smoke
npm run weekly:visual
```

The smoke proves idempotent start and completion, strict count validation, five metric states, immutable replay behavior, and zero downstream actions. The visual check captures exact 1440px and 390px owner views and rejects horizontal overflow, clipped text, or unstable navigation.
