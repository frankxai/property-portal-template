import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  assertOwnerInboxAssigneeTenant,
  ownerInboxDetailFromRows,
  ownerInboxExternalActionReceipt,
  ownerInboxListItemFromRow,
  OwnerInboxError,
  planOwnerInboxMutation
} from "../lib/owner-inbox.ts";
import { ownerRoleHasCapability } from "../lib/owner-capabilities.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(new URL(path, `file:///${root.replaceAll("\\", "/")}/`), "utf8");

function expectCode(code, run) {
  assert.throws(run, (error) => error instanceof OwnerInboxError && error.code === code);
}

const current = {
  status: "in-progress",
  assigneeMemberId: null,
  dueAt: null,
  draftReply: "Draft response",
  draftApprovalState: "pending",
  version: 4
};

for (const role of ["owner", "agency-admin"]) {
  assert.equal(ownerRoleHasCapability(role, "owner-inbox:read"), true);
  assert.equal(ownerRoleHasCapability(role, "owner-inbox:write"), true);
  assert.equal(ownerRoleHasCapability(role, "owner-inbox:close"), true);
}
assert.equal(ownerRoleHasCapability("manager", "owner-inbox:read"), true);
assert.equal(ownerRoleHasCapability("manager", "owner-inbox:write"), true);
assert.equal(ownerRoleHasCapability("manager", "owner-inbox:close"), false);
assert.equal(ownerRoleHasCapability("operator", "owner-inbox:read"), false);
assert.equal(ownerRoleHasCapability("viewer", "owner-inbox:read"), false);
assert.equal(ownerRoleHasCapability("owner", "identity:revoke"), true);

expectCode("stale", () => planOwnerInboxMutation(current, { expectedVersion: 3, status: "triage" }, "owner"));
expectCode("invalid-input", () => planOwnerInboxMutation({ ...current, status: "new" }, { expectedVersion: 4, status: "closed" }, "owner"));
expectCode("forbidden", () => planOwnerInboxMutation(current, { expectedVersion: 4, status: "resolved" }, "manager"));
expectCode("forbidden", () => planOwnerInboxMutation(current, { expectedVersion: 4, draftApprovalState: "approved" }, "manager"));

const ownerResolution = planOwnerInboxMutation(current, { expectedVersion: 4, status: "resolved" }, "owner");
assert.equal(ownerResolution.status, "resolved");
assert.equal(ownerResolution.version, 5);
const managerTriage = planOwnerInboxMutation(current, {
  expectedVersion: 4,
  status: "triage",
  assigneeMemberId: "member-a",
  dueAt: "2026-07-23T12:00:00.000Z",
  draftReply: "Internal draft only"
}, "manager");
assert.deepEqual(managerTriage.changedFields.includes("assignee"), true);
assert.equal(managerTriage.draftApprovalState, "draft");

const privateRow = {
  organization_id: "tenant-a",
  source_type: "inquiry",
  source_id: "inq-1",
  source_status: "owner-review",
  inbox_urgency: "standard",
  source_created_at: "2026-07-22T10:00:00.000Z",
  property_id: "property-1",
  property_name: "Private property label",
  sanitized_summary: "Inquiry for a reviewed property window",
  owner_action: "Review the draft",
  workflow_status: null,
  assignee_member_id: null,
  due_at: null,
  draft_reply: "",
  draft_approval_state: null,
  workflow_version: null,
  requester_name: "Private Requester",
  requester_email: "requester-private@example.test",
  rental_window: "Private dates",
  message_private: "Private request body"
};
const listItem = ownerInboxListItemFromRow(privateRow, "tenant-a", new Date("2026-07-22T11:00:00.000Z"));
const listJson = JSON.stringify(listItem);
assert.equal("privateRequest" in listItem, false);
assert.equal(listJson.includes("requester-private@example.test"), false);
assert.equal(listJson.includes("Private request body"), false);
const detail = ownerInboxDetailFromRows(privateRow, [], "tenant-a");
assert.equal(detail.privateRequest.requesterEmail, "requester-private@example.test");
assert.equal(detail.privateRequest.message, "Private request body");
expectCode("not-found", () => ownerInboxListItemFromRow(privateRow, "tenant-b"));

assert.doesNotThrow(() => assertOwnerInboxAssigneeTenant({
  organizationId: "tenant-a",
  status: "active",
  role: "manager"
}, "tenant-a"));
expectCode("forbidden", () => assertOwnerInboxAssigneeTenant({
  organizationId: "tenant-b",
  status: "active",
  role: "owner"
}, "tenant-a"));

assert.equal(ownerInboxExternalActionReceipt.externalActionCount, 0);
assert.deepEqual(ownerInboxExternalActionReceipt.externalActionsPerformed, []);
assert.deepEqual(ownerInboxExternalActionReceipt.commitmentsCreated, []);

const [migration, schema, rls, service, listRoute, detailRoute] = await Promise.all([
  read("db/006-owner-inbox.sql"),
  read("db/schema.sql"),
  read("db/rls.sql"),
  read("lib/owner-inbox.ts"),
  read("app/api/owner-inbox/route.ts"),
  read("app/api/owner-inbox/[type]/[id]/route.ts")
]);
for (const sql of [migration, schema]) {
  assert.match(sql, /unique \(id, organization_id\)/i);
  assert.match(sql, /foreign key \(assignee_member_id, organization_id\)[\s\S]*references organization_members\(id, organization_id\)/i);
  assert.match(sql, /property_os_owner_inbox_source_belongs_to_tenant/i);
  assert.match(sql, /where id = new\.source_id and organization_id = new\.organization_id/i);
  assert.match(sql, /before insert or update on owner_inbox_work_items/i);
  assert.match(sql, /create trigger owner_inbox_event_source_tenant[\s\S]*before insert on owner_inbox_events[\s\S]*property_os_owner_inbox_source_belongs_to_tenant/i);
  assert.match(sql, /owner_inbox_events is append-only/i);
}
assert.match(rls, /owner_inbox_work_items_tenant_isolation/);
assert.match(rls, /owner_inbox_events_tenant_select/);
assert.match(rls, /owner_inbox_events_tenant_insert/);
assert.doesNotMatch(rls, /create policy owner_inbox_events[^;]*for all/i);
assert.match(service, /lockedSourceStatus/);
assert.match(service, /for update/);
assert.match(service, /and version = \$\{current\.version\}/);
assert.match(service, /and member\.organization_id = work\.organization_id/);
assert.match(listRoute, /requireOwnerApiAccess\(request, "owner-inbox:read"\)/);
assert.match(detailRoute, /requireOwnerApiAccess\(request, "owner-inbox:read"\)/);
assert.match(detailRoute, /private, no-store/);
assert.doesNotMatch(`${listRoute}\n${detailRoute}\n${service}`, /\b(sendMail|sendMessage|dispatchVendor)\s*\(/i);

console.log("Owner inbox smoke passed: capability, privacy, tenant, transition, version, audit, and zero-action boundaries verified.");
