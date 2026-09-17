# Owner Inbox

The protected Owner Inbox turns tenant-scoped `inquiries` and `support_tickets` into one internal owner work queue at `/admin/inbox`.

## Boundary

- `owner`, `agency-admin`, and `manager` can read, triage, assign, set due dates, edit internal reply drafts, and move work through allowed non-closing states.
- Only `owner` and `agency-admin` have `owner-inbox:close`, which is required to resolve or close work.
- Existing `approvals:decide` is required to approve a draft or request changes. Managers can submit a draft for review but cannot decide it.
- Viewer and operator access is unsupported. The protected APIs return `403` for an authenticated role without the required capability.
- No inbox endpoint sends email or WhatsApp, dispatches a vendor, changes a lease, price, or availability, or makes another external commitment. Mutation receipts always report zero external actions.

## HTTP Surface

- `GET /api/owner-inbox`: sanitized queue rows only. It never selects or serializes requester email, requester name, rental window, or private request message.
- `GET /api/owner-inbox/[type]/[id]`: private request detail, active tenant assignees, and the audit timeline. It requires `owner-inbox:read`.
- `PATCH /api/owner-inbox/[type]/[id]`: version-checked internal workflow update. It requires `owner-inbox:write`; close and approval decisions receive additional capability checks.

All responses use `Cache-Control: private, no-store, max-age=0`. A foreign-tenant source is returned as not found so the endpoint does not disclose its existence.

## Storage And Concurrency

Apply `db/006-owner-inbox.sql` to an existing v0.2 database, then rerun `db/rls.sql`.

`owner_inbox_work_items` is a workflow overlay. The queue union reads every existing and future inquiry/support row even when no overlay exists, so public intake behavior remains unchanged. The first owner update creates the overlay.

Tenant binding is enforced in several places:

- forced RLS scopes reads and writes to `property_os.organization_id`;
- `(assignee_member_id, organization_id)` references the composite organization member key;
- a database trigger requires the polymorphic source id to exist in the same organization on every workflow insert or update;
- application updates lock the tenant-scoped source and workflow rows before checking `expectedVersion`;
- an update includes the current version in its `where` clause and returns `409` when stale.

`owner_inbox_events` is append-only. RLS permits tenant-scoped select and insert only, and a trigger rejects update or delete. Audit metadata records changed field names and internal state, never draft or requester content.

## State Model

Internal states are `new`, `triage`, `in-progress`, `waiting-owner`, `resolved`, and `closed`. Transition rules are explicit in `lib/owner-inbox.ts`. Moving into `resolved` or `closed` requires `owner-inbox:close`.

Draft approval states are `none`, `draft`, `pending`, `approved`, and `changes-requested`. Editing draft text resets approval to `draft`; clearing it resets approval to `none`.

## Verification

```bash
npm run inbox:smoke
npm run validate
npm run typecheck
npm run build
```

The focused smoke covers the role/capability matrix, sanitized list boundary, authorized private detail shape, tenant mismatch, foreign-tenant assignee rejection, source tenant trigger, invalid transition, stale version, manager closure/approval denial, append-only audit controls, and zero external actions.
