import { randomUUID } from "node:crypto";
import postgres from "postgres";
import type { OwnerRole } from "./identity-policy.ts";
import { ownerRoleHasCapability } from "./owner-capabilities.ts";

export const ownerInboxSourceTypes = ["inquiry", "support"] as const;
export const ownerInboxStatuses = ["new", "triage", "in-progress", "waiting-owner", "resolved", "closed"] as const;
export const ownerInboxApprovalStates = ["none", "draft", "pending", "approved", "changes-requested"] as const;
export const ownerInboxExternalActionReceipt = Object.freeze({
  externalActionsPerformed: [] as string[],
  externalActionCount: 0,
  commitmentsCreated: [] as string[]
});
export const ownerInboxActionBoundary = [
  "email or WhatsApp send",
  "vendor dispatch",
  "lease, pricing, or availability commitment",
  "any other external action"
] as const;

export type OwnerInboxSourceType = (typeof ownerInboxSourceTypes)[number];
export type OwnerInboxStatus = (typeof ownerInboxStatuses)[number];
export type OwnerInboxApprovalState = (typeof ownerInboxApprovalStates)[number];
export type OwnerInboxDueState = "none" | "scheduled" | "due-soon" | "overdue" | "complete";

export type OwnerInboxAssignee = {
  id: string;
  label: string;
  role: OwnerRole;
};

export type OwnerInboxListItem = {
  id: string;
  type: OwnerInboxSourceType;
  status: OwnerInboxStatus;
  urgency: "standard" | "urgent";
  createdAt: string;
  property: { id: string; name: string };
  sanitizedSummary: string;
  ownerAction: string;
  assignee: OwnerInboxAssignee | null;
  dueAt: string | null;
  dueState: OwnerInboxDueState;
  draftApprovalState: OwnerInboxApprovalState;
  version: number;
};

export type OwnerInboxTimelineEvent = {
  id: string;
  eventType: string;
  actorId: string;
  actorRole: string;
  fromStatus: OwnerInboxStatus | null;
  toStatus: OwnerInboxStatus | null;
  version: number | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
};

export type OwnerInboxDetail = OwnerInboxListItem & {
  privateRequest: {
    requesterName: string | null;
    requesterEmail: string | null;
    rentalWindow: string | null;
    message: string;
  };
  draftReply: string;
  timeline: OwnerInboxTimelineEvent[];
};

export type OwnerInboxDetailResult = {
  item: OwnerInboxDetail;
  assignees: OwnerInboxAssignee[];
};

export type OwnerInboxFilters = {
  type?: OwnerInboxSourceType;
  status?: OwnerInboxStatus;
  urgency?: "standard" | "urgent";
  due?: OwnerInboxDueState;
};

export type OwnerInboxMutation = {
  expectedVersion: number;
  status?: OwnerInboxStatus;
  assigneeMemberId?: string | null;
  dueAt?: string | null;
  draftReply?: string;
  draftApprovalState?: OwnerInboxApprovalState;
};

export type OwnerInboxWorkflowState = {
  status: OwnerInboxStatus;
  assigneeMemberId: string | null;
  dueAt: string | null;
  draftReply: string;
  draftApprovalState: OwnerInboxApprovalState;
  version: number;
};

export type PlannedOwnerInboxMutation = OwnerInboxWorkflowState & {
  changedFields: string[];
  eventType: "triaged" | "assigned" | "due-date-set" | "draft-updated" | "approval-updated" | "status-changed" | "updated";
  previousStatus: OwnerInboxStatus;
};

export type OwnerInboxDatabase = {
  list(organizationId: string, now: Date): Promise<OwnerInboxListItem[]>;
  detail(organizationId: string, type: OwnerInboxSourceType, id: string, now: Date): Promise<OwnerInboxDetailResult | null>;
  update(input: {
    organizationId: string;
    type: OwnerInboxSourceType;
    id: string;
    actorId: string;
    actorRole: OwnerRole;
    mutation: OwnerInboxMutation;
    now: Date;
  }): Promise<OwnerInboxDetailResult>;
};

type OwnerInboxOptions = {
  database?: OwnerInboxDatabase;
  env?: NodeJS.ProcessEnv;
  now?: Date;
};

const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const allowedTransitions: Record<OwnerInboxStatus, ReadonlySet<OwnerInboxStatus>> = {
  new: new Set(["triage", "in-progress"]),
  triage: new Set(["new", "in-progress", "waiting-owner"]),
  "in-progress": new Set(["triage", "waiting-owner", "resolved"]),
  "waiting-owner": new Set(["in-progress", "resolved"]),
  resolved: new Set(["in-progress", "closed"]),
  closed: new Set(["in-progress"])
};

let sqlClient: postgres.Sql | undefined;
let sqlClientUrl = "";

export class OwnerInboxError extends Error {
  readonly code: "invalid-input" | "not-found" | "forbidden" | "stale" | "database-unavailable";

  constructor(code: OwnerInboxError["code"], message: string = code) {
    super(message);
    this.name = "OwnerInboxError";
    this.code = code;
  }
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function configuredOrganizationId(env: NodeJS.ProcessEnv) {
  const value = env.PROPERTY_OS_ORG_ID?.trim() || "";
  return stableIdPattern.test(value) ? value : null;
}

export function validOwnerInboxSource(type: unknown): type is OwnerInboxSourceType {
  return typeof type === "string" && ownerInboxSourceTypes.includes(type as OwnerInboxSourceType);
}

export function validOwnerInboxId(id: unknown): id is string {
  return typeof id === "string" && stableIdPattern.test(id);
}

function hasOwn(input: object, key: string) {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function optionalIsoDate(value: unknown) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 40) throw new OwnerInboxError("invalid-input", "Due date is invalid.");
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) throw new OwnerInboxError("invalid-input", "Due date is invalid.");
  return date.toISOString();
}

export function parseOwnerInboxMutation(input: Record<string, unknown>): OwnerInboxMutation {
  if (!Number.isInteger(input.expectedVersion) || Number(input.expectedVersion) < 0) {
    throw new OwnerInboxError("invalid-input", "A non-negative expectedVersion is required.");
  }
  const mutation: OwnerInboxMutation = { expectedVersion: Number(input.expectedVersion) };
  if (hasOwn(input, "status")) {
    if (!ownerInboxStatuses.includes(input.status as OwnerInboxStatus)) throw new OwnerInboxError("invalid-input", "Status is invalid.");
    mutation.status = input.status as OwnerInboxStatus;
  }
  if (hasOwn(input, "assigneeMemberId")) {
    if (input.assigneeMemberId !== null && !validOwnerInboxId(input.assigneeMemberId)) {
      throw new OwnerInboxError("invalid-input", "Assignee is invalid.");
    }
    mutation.assigneeMemberId = input.assigneeMemberId as string | null;
  }
  if (hasOwn(input, "dueAt")) mutation.dueAt = optionalIsoDate(input.dueAt);
  if (hasOwn(input, "draftReply")) {
    if (typeof input.draftReply !== "string" || input.draftReply.length > 8000 || input.draftReply.includes("\0")) {
      throw new OwnerInboxError("invalid-input", "Draft reply must be at most 8000 characters.");
    }
    mutation.draftReply = input.draftReply;
  }
  if (hasOwn(input, "draftApprovalState")) {
    if (!ownerInboxApprovalStates.includes(input.draftApprovalState as OwnerInboxApprovalState)) {
      throw new OwnerInboxError("invalid-input", "Draft approval state is invalid.");
    }
    mutation.draftApprovalState = input.draftApprovalState as OwnerInboxApprovalState;
  }
  if (Object.keys(mutation).length === 1) throw new OwnerInboxError("invalid-input", "At least one inbox field is required.");
  return mutation;
}

export function planOwnerInboxMutation(
  current: OwnerInboxWorkflowState,
  mutation: OwnerInboxMutation,
  actorRole: OwnerRole
): PlannedOwnerInboxMutation {
  if (!ownerRoleHasCapability(actorRole, "owner-inbox:write")) throw new OwnerInboxError("forbidden");
  if (mutation.expectedVersion !== current.version) throw new OwnerInboxError("stale");

  const next: OwnerInboxWorkflowState = { ...current };
  const changedFields: string[] = [];
  if (mutation.status !== undefined && mutation.status !== current.status) {
    if (!allowedTransitions[current.status].has(mutation.status)) throw new OwnerInboxError("invalid-input", "Status transition is not allowed.");
    if (["resolved", "closed"].includes(mutation.status) && !ownerRoleHasCapability(actorRole, "owner-inbox:close")) {
      throw new OwnerInboxError("forbidden", "This role cannot resolve or close inbox work.");
    }
    next.status = mutation.status;
    changedFields.push("status");
  }
  if (mutation.assigneeMemberId !== undefined && mutation.assigneeMemberId !== current.assigneeMemberId) {
    next.assigneeMemberId = mutation.assigneeMemberId;
    changedFields.push("assignee");
  }
  if (mutation.dueAt !== undefined && mutation.dueAt !== current.dueAt) {
    next.dueAt = mutation.dueAt;
    changedFields.push("dueAt");
  }
  if (mutation.draftReply !== undefined && mutation.draftReply !== current.draftReply) {
    next.draftReply = mutation.draftReply;
    next.draftApprovalState = mutation.draftReply.trim() ? "draft" : "none";
    changedFields.push("draftReply");
    if (next.draftApprovalState !== current.draftApprovalState) changedFields.push("draftApprovalState");
  }
  if (mutation.draftApprovalState !== undefined && mutation.draftApprovalState !== next.draftApprovalState) {
    if (!next.draftReply.trim() && mutation.draftApprovalState !== "none") {
      throw new OwnerInboxError("invalid-input", "A draft is required before approval can change.");
    }
    if (["approved", "changes-requested"].includes(mutation.draftApprovalState) && !ownerRoleHasCapability(actorRole, "approvals:decide")) {
      throw new OwnerInboxError("forbidden", "This role cannot decide draft approval.");
    }
    next.draftApprovalState = mutation.draftApprovalState;
    if (!changedFields.includes("draftApprovalState")) changedFields.push("draftApprovalState");
  }
  if (changedFields.length === 0) throw new OwnerInboxError("invalid-input", "The inbox item is already in that state.");

  next.version = current.version + 1;
  const eventType = changedFields.includes("status")
    ? next.status === "triage" ? "triaged" : "status-changed"
    : changedFields.includes("assignee") ? "assigned"
      : changedFields.includes("dueAt") ? "due-date-set"
        : changedFields.includes("draftReply") ? "draft-updated"
          : changedFields.includes("draftApprovalState") ? "approval-updated"
            : "updated";
  return { ...next, changedFields, eventType, previousStatus: current.status };
}

function fallbackStatus(type: OwnerInboxSourceType, sourceStatus: string): OwnerInboxStatus {
  if (sourceStatus === "archived" || sourceStatus === "closed") return "closed";
  if (sourceStatus === "resolved" || sourceStatus === "replied") return "resolved";
  if (type === "support" && sourceStatus === "triage") return "triage";
  return "new";
}

export function ownerInboxDueState(dueAt: string | null, status: OwnerInboxStatus, now = new Date()): OwnerInboxDueState {
  if (["resolved", "closed"].includes(status)) return "complete";
  if (!dueAt) return "none";
  const delta = new Date(dueAt).valueOf() - now.valueOf();
  if (delta < 0) return "overdue";
  if (delta <= 24 * 60 * 60 * 1000) return "due-soon";
  return "scheduled";
}

function requireTenant(row: Record<string, unknown>, organizationId: string) {
  if (String(row.organization_id || "") !== organizationId) throw new OwnerInboxError("not-found");
}

export function assertOwnerInboxAssigneeTenant(
  member: { organizationId: string; status: string; role: string } | null,
  organizationId: string
) {
  if (
    !member
    || member.organizationId !== organizationId
    || member.status !== "active"
    || !["owner", "agency-admin", "manager"].includes(member.role)
  ) {
    throw new OwnerInboxError("forbidden", "Assignee does not belong to this organization.");
  }
}

function assigneeFromRow(row: Record<string, unknown>): OwnerInboxAssignee | null {
  if (!row.assignee_member_id) return null;
  return {
    id: String(row.assignee_member_id),
    label: String(row.assignee_label || "Assigned owner"),
    role: row.assignee_role as OwnerRole
  };
}

export function ownerInboxListItemFromRow(row: Record<string, unknown>, organizationId: string, now = new Date()): OwnerInboxListItem {
  requireTenant(row, organizationId);
  const type = row.source_type as OwnerInboxSourceType;
  const status = (row.workflow_status || fallbackStatus(type, String(row.source_status))) as OwnerInboxStatus;
  const dueAt = iso(row.due_at as Date | string | null);
  return {
    id: String(row.source_id),
    type,
    status,
    urgency: row.inbox_urgency === "urgent" ? "urgent" : "standard",
    createdAt: iso(row.source_created_at as Date | string) as string,
    property: { id: String(row.property_id), name: String(row.property_name) },
    sanitizedSummary: String(row.sanitized_summary),
    ownerAction: String(row.owner_action),
    assignee: assigneeFromRow(row),
    dueAt,
    dueState: ownerInboxDueState(dueAt, status, now),
    draftApprovalState: (row.draft_approval_state || "none") as OwnerInboxApprovalState,
    version: Number(row.workflow_version || 0)
  };
}

function timelineFromRows(rows: Record<string, unknown>[]): OwnerInboxTimelineEvent[] {
  return rows.map((row) => ({
    id: String(row.id),
    eventType: String(row.event_type),
    actorId: String(row.actor_id),
    actorRole: String(row.actor_role),
    fromStatus: row.from_status ? row.from_status as OwnerInboxStatus : null,
    toStatus: row.to_status ? row.to_status as OwnerInboxStatus : null,
    version: row.event_version === null || row.event_version === undefined ? null : Number(row.event_version),
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {},
    occurredAt: iso(row.occurred_at as Date | string) as string
  }));
}

export function ownerInboxDetailFromRows(
  row: Record<string, unknown>,
  timelineRows: Record<string, unknown>[],
  organizationId: string,
  now = new Date()
): OwnerInboxDetail {
  const listItem = ownerInboxListItemFromRow(row, organizationId, now);
  return {
    ...listItem,
    privateRequest: {
      requesterName: row.requester_name ? String(row.requester_name) : null,
      requesterEmail: row.requester_email ? String(row.requester_email) : null,
      rentalWindow: row.rental_window ? String(row.rental_window) : null,
      message: String(row.message_private)
    },
    draftReply: row.draft_reply ? String(row.draft_reply) : "",
    timeline: timelineFromRows(timelineRows)
  };
}

function filterItems(items: OwnerInboxListItem[], filters: OwnerInboxFilters) {
  return items.filter((item) => (
    (!filters.type || item.type === filters.type)
    && (!filters.status || item.status === filters.status)
    && (!filters.urgency || item.urgency === filters.urgency)
    && (!filters.due || item.dueState === filters.due)
  ));
}

async function sourceRows(sql: postgres.Sql, organizationId: string) {
  return sql<Record<string, unknown>[]>`
    select
      source.organization_id, source.source_type, source.source_id, source.source_status,
      source.inbox_urgency, source.source_created_at, source.property_id, source.property_name,
      source.sanitized_summary, source.owner_action,
      work.status as workflow_status, work.assignee_member_id, work.due_at,
      work.draft_approval_state, work.version as workflow_version,
      member.email as assignee_label, member.role as assignee_role
    from (
      select i.organization_id, 'inquiry'::text as source_type, i.id as source_id,
        i.status as source_status, 'standard'::text as inbox_urgency, i.created_at as source_created_at,
        p.id as property_id, p.name as property_name, i.sanitized_summary,
        'Review and approve a draft response before any manual reply.'::text as owner_action
      from inquiries i
      join properties p on p.id = i.property_id and p.organization_id = i.organization_id
      where i.organization_id = ${organizationId}
      union all
      select s.organization_id, 'support'::text, s.id, s.status,
        case when lower(s.urgency) in ('urgent', 'emergency', 'high') or s.route = 'urgent-owner-escalation'
          then 'urgent' else 'standard' end,
        s.created_at, p.id, p.name, s.sanitized_summary, s.owner_action
      from support_tickets s
      join properties p on p.id = s.property_id and p.organization_id = s.organization_id
      where s.organization_id = ${organizationId}
    ) source
    left join owner_inbox_work_items work
      on work.organization_id = source.organization_id
      and work.source_type = source.source_type
      and work.source_id = source.source_id
    left join organization_members member
      on member.id = work.assignee_member_id
      and member.organization_id = work.organization_id
    order by source.source_created_at desc
    limit 500
  `;
}

async function detailRow(sql: postgres.Sql, organizationId: string, type: OwnerInboxSourceType, id: string) {
  if (type === "inquiry") {
    return (await sql<Record<string, unknown>[]>`
      select i.organization_id, 'inquiry'::text as source_type, i.id as source_id, i.status as source_status,
        'standard'::text as inbox_urgency, i.created_at as source_created_at,
        p.id as property_id, p.name as property_name, i.sanitized_summary,
        'Review and approve a draft response before any manual reply.'::text as owner_action,
        i.requester_name, i.requester_email, i.rental_window, i.message_private,
        work.status as workflow_status, work.assignee_member_id, work.due_at, work.draft_reply,
        work.draft_approval_state, work.version as workflow_version,
        member.email as assignee_label, member.role as assignee_role
      from inquiries i
      join properties p on p.id = i.property_id and p.organization_id = i.organization_id
      left join owner_inbox_work_items work
        on work.organization_id = i.organization_id and work.source_type = 'inquiry' and work.source_id = i.id
      left join organization_members member
        on member.id = work.assignee_member_id and member.organization_id = work.organization_id
      where i.organization_id = ${organizationId} and i.id = ${id}
      limit 1
    `)[0] || null;
  }
  return (await sql<Record<string, unknown>[]>`
    select s.organization_id, 'support'::text as source_type, s.id as source_id, s.status as source_status,
      case when lower(s.urgency) in ('urgent', 'emergency', 'high') or s.route = 'urgent-owner-escalation'
        then 'urgent' else 'standard' end as inbox_urgency,
      s.created_at as source_created_at, p.id as property_id, p.name as property_name,
      s.sanitized_summary, s.owner_action, null::text as requester_name, null::text as requester_email,
      null::text as rental_window, s.message_private,
      work.status as workflow_status, work.assignee_member_id, work.due_at, work.draft_reply,
      work.draft_approval_state, work.version as workflow_version,
      member.email as assignee_label, member.role as assignee_role
    from support_tickets s
    join properties p on p.id = s.property_id and p.organization_id = s.organization_id
    left join owner_inbox_work_items work
      on work.organization_id = s.organization_id and work.source_type = 'support' and work.source_id = s.id
    left join organization_members member
      on member.id = work.assignee_member_id and member.organization_id = work.organization_id
    where s.organization_id = ${organizationId} and s.id = ${id}
    limit 1
  `)[0] || null;
}

async function timelineRows(sql: postgres.Sql, organizationId: string, type: OwnerInboxSourceType, id: string) {
  const sourceSubject = type === "inquiry" ? "inquiry" : "support_ticket";
  return sql<Record<string, unknown>[]>`
    select id, event_type, actor as actor_id, actor as actor_role,
      null::text as from_status, null::text as to_status, null::integer as event_version,
      metadata, created_at as occurred_at
    from audit_events
    where organization_id = ${organizationId} and subject_type = ${sourceSubject} and subject_id = ${id}
    union all
    select id, event_type, actor_id, actor_role, from_status, to_status,
      version as event_version, metadata, occurred_at
    from owner_inbox_events
    where organization_id = ${organizationId} and source_type = ${type} and source_id = ${id}
    order by occurred_at desc
  `;
}

async function assigneeRows(sql: postgres.Sql, organizationId: string): Promise<OwnerInboxAssignee[]> {
  const rows = await sql<{ id: string; email: string; role: OwnerRole }[]>`
    select id, email, role
    from organization_members
    where organization_id = ${organizationId}
      and status = 'active'
      and role in ('owner', 'agency-admin', 'manager')
    order by email asc
  `;
  return rows.map((row) => ({ id: row.id, label: row.email, role: row.role }));
}

async function lockedSourceStatus(sql: postgres.Sql, organizationId: string, type: OwnerInboxSourceType, id: string) {
  const rows = type === "inquiry"
    ? await sql<{ status: string }[]>`
        select status from inquiries where organization_id = ${organizationId} and id = ${id} for update
      `
    : await sql<{ status: string }[]>`
        select status from support_tickets where organization_id = ${organizationId} and id = ${id} for update
      `;
  return rows[0]?.status || null;
}

function postgresDatabase(databaseUrl: string): OwnerInboxDatabase {
  if (!sqlClient || sqlClientUrl !== databaseUrl) {
    sqlClient = postgres(databaseUrl, { max: 2, idle_timeout: 20, connect_timeout: 10 });
    sqlClientUrl = databaseUrl;
  }
  const sql = sqlClient;
  return {
    async list(organizationId, now) {
      return sql.begin(async (tx) => {
        await tx`select set_config('property_os.organization_id', ${organizationId}, true)`;
        const rows = await sourceRows(tx as unknown as postgres.Sql, organizationId);
        return rows.map((row) => ownerInboxListItemFromRow(row, organizationId, now));
      }) as Promise<OwnerInboxListItem[]>;
    },
    async detail(organizationId, type, id, now) {
      return sql.begin(async (tx) => {
        await tx`select set_config('property_os.organization_id', ${organizationId}, true)`;
        const scoped = tx as unknown as postgres.Sql;
        const row = await detailRow(scoped, organizationId, type, id);
        if (!row) return null;
        const [timeline, assignees] = await Promise.all([
          timelineRows(scoped, organizationId, type, id),
          assigneeRows(scoped, organizationId)
        ]);
        return { item: ownerInboxDetailFromRows(row, timeline, organizationId, now), assignees };
      }) as Promise<OwnerInboxDetailResult | null>;
    },
    async update(input) {
      return sql.begin(async (tx) => {
        await tx`select set_config('property_os.organization_id', ${input.organizationId}, true)`;
        const scoped = tx as unknown as postgres.Sql;
        const sourceStatus = await lockedSourceStatus(scoped, input.organizationId, input.type, input.id);
        if (!sourceStatus) throw new OwnerInboxError("not-found");
        const workflowRows = await scoped<Record<string, unknown>[]>`
          select status, assignee_member_id, due_at, draft_reply, draft_approval_state, version
          from owner_inbox_work_items
          where organization_id = ${input.organizationId} and source_type = ${input.type} and source_id = ${input.id}
          for update
        `;
        const workflow = workflowRows[0];
        const current: OwnerInboxWorkflowState = workflow ? {
          status: workflow.status as OwnerInboxStatus,
          assigneeMemberId: workflow.assignee_member_id ? String(workflow.assignee_member_id) : null,
          dueAt: iso(workflow.due_at as Date | string | null),
          draftReply: String(workflow.draft_reply || ""),
          draftApprovalState: workflow.draft_approval_state as OwnerInboxApprovalState,
          version: Number(workflow.version)
        } : {
          status: fallbackStatus(input.type, sourceStatus),
          assigneeMemberId: null,
          dueAt: null,
          draftReply: "",
          draftApprovalState: "none",
          version: 0
        };
        const planned = planOwnerInboxMutation(current, input.mutation, input.actorRole);

        if (planned.assigneeMemberId) {
          const members = await scoped<{ organization_id: string; status: string; role: string }[]>`
            select organization_id, status, role from organization_members
            where id = ${planned.assigneeMemberId}
              and organization_id = ${input.organizationId}
              and status = 'active'
              and role in ('owner', 'agency-admin', 'manager')
            limit 1 for share
          `;
          assertOwnerInboxAssigneeTenant(members[0] ? {
            organizationId: members[0].organization_id,
            status: members[0].status,
            role: members[0].role
          } : null, input.organizationId);
        }

        const nowIso = input.now.toISOString();
        if (workflow) {
          const updated = await scoped<{ version: number }[]>`
            update owner_inbox_work_items
            set status = ${planned.status}, assignee_member_id = ${planned.assigneeMemberId},
              due_at = ${planned.dueAt}, draft_reply = ${planned.draftReply},
              draft_approval_state = ${planned.draftApprovalState}, version = ${planned.version},
              updated_by = ${input.actorId}, updated_at = ${nowIso}
            where organization_id = ${input.organizationId} and source_type = ${input.type}
              and source_id = ${input.id} and version = ${current.version}
            returning version
          `;
          if (!updated[0]) throw new OwnerInboxError("stale");
        } else {
          await scoped`
            insert into owner_inbox_work_items (
              organization_id, source_type, source_id, status, assignee_member_id, due_at,
              draft_reply, draft_approval_state, version, updated_by, created_at, updated_at
            ) values (
              ${input.organizationId}, ${input.type}, ${input.id}, ${planned.status},
              ${planned.assigneeMemberId}, ${planned.dueAt}, ${planned.draftReply},
              ${planned.draftApprovalState}, ${planned.version}, ${input.actorId}, ${nowIso}, ${nowIso}
            )
          `;
        }
        await scoped`
          insert into owner_inbox_events (
            id, organization_id, source_type, source_id, actor_id, actor_role, event_type,
            from_status, to_status, version, metadata, occurred_at
          ) values (
            ${`inbox-event-${randomUUID()}`}, ${input.organizationId}, ${input.type}, ${input.id},
            ${input.actorId}, ${input.actorRole}, ${planned.eventType}, ${planned.previousStatus},
            ${planned.status}, ${planned.version},
            ${scoped.json({
              changedFields: planned.changedFields,
              assigneeMemberId: planned.assigneeMemberId,
              dueAt: planned.dueAt,
              draftApprovalState: planned.draftApprovalState,
              externalActionsPerformed: [],
              commitmentsCreated: []
            })}, ${nowIso}
          )
        `;
        const row = await detailRow(scoped, input.organizationId, input.type, input.id);
        if (!row) throw new OwnerInboxError("not-found");
        const [timeline, assignees] = await Promise.all([
          timelineRows(scoped, input.organizationId, input.type, input.id),
          assigneeRows(scoped, input.organizationId)
        ]);
        return { item: ownerInboxDetailFromRows(row, timeline, input.organizationId, input.now), assignees };
      }) as Promise<OwnerInboxDetailResult>;
    }
  };
}

function databaseFromOptions(options: OwnerInboxOptions) {
  if (options.database) return options.database;
  const databaseUrl = options.env ? options.env.DATABASE_URL : process.env.DATABASE_URL;
  return databaseUrl ? postgresDatabase(databaseUrl) : null;
}

function context(options: OwnerInboxOptions) {
  const env = options.env ?? process.env;
  const organizationId = configuredOrganizationId(env);
  const database = databaseFromOptions(options);
  if (!organizationId || !database) throw new OwnerInboxError("database-unavailable");
  return { organizationId, database, now: options.now ?? new Date() };
}

export async function listOwnerInbox(filters: OwnerInboxFilters = {}, options: OwnerInboxOptions = {}) {
  const value = context(options);
  try {
    return filterItems(await value.database.list(value.organizationId, value.now), filters);
  } catch (error) {
    if (error instanceof OwnerInboxError) throw error;
    console.error("Owner inbox list unavailable", { code: "OWNER_INBOX_DATABASE_UNAVAILABLE" });
    throw new OwnerInboxError("database-unavailable");
  }
}

export async function getOwnerInboxDetail(type: OwnerInboxSourceType, id: string, options: OwnerInboxOptions = {}) {
  if (!validOwnerInboxSource(type) || !validOwnerInboxId(id)) throw new OwnerInboxError("invalid-input");
  const value = context(options);
  try {
    return await value.database.detail(value.organizationId, type, id, value.now);
  } catch (error) {
    if (error instanceof OwnerInboxError) throw error;
    console.error("Owner inbox detail unavailable", { code: "OWNER_INBOX_DATABASE_UNAVAILABLE" });
    throw new OwnerInboxError("database-unavailable");
  }
}

export async function updateOwnerInboxItem(
  input: {
    type: OwnerInboxSourceType;
    id: string;
    actorId: string;
    actorRole: OwnerRole;
    mutation: OwnerInboxMutation;
  },
  options: OwnerInboxOptions = {}
) {
  if (!validOwnerInboxSource(input.type) || !validOwnerInboxId(input.id) || !input.actorId) {
    throw new OwnerInboxError("invalid-input");
  }
  const value = context(options);
  try {
    return await value.database.update({
      organizationId: value.organizationId,
      type: input.type,
      id: input.id,
      actorId: input.actorId,
      actorRole: input.actorRole,
      mutation: input.mutation,
      now: value.now
    });
  } catch (error) {
    if (error instanceof OwnerInboxError) throw error;
    console.error("Owner inbox update unavailable", { code: "OWNER_INBOX_DATABASE_UNAVAILABLE" });
    throw new OwnerInboxError("database-unavailable");
  }
}
