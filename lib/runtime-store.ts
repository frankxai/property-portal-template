import postgres from "postgres";
import type { AgentMission, AgentRunPayload, ApprovalRecord, AuditEvent, ListingDryRunPayload } from "@/lib/runtime-contracts";
import { runtimeHealth } from "@/lib/runtime-contracts";
import type { InquiryPayload, SupportPayload } from "@/lib/types";

export type RuntimePersistenceReceipt = {
  adapter: "demo-memory" | "postgres" | "mcp-control-plane";
  status: "recorded" | "failed";
  target: string;
  detail: string;
};

export type RuntimeQueueItem = {
  id: string;
  kind: "inquiry" | "support" | "approval" | "agent-mission" | "agent-run" | "listing-dry-run" | "notification";
  route: string;
  sanitizedSummary: string;
  ownerAction: string;
  ownerApprovalRequired: boolean;
  createdAt: string;
};

export type RuntimeSnapshot = {
  health: ReturnType<typeof runtimeHealth>;
  counts: Record<RuntimeQueueItem["kind"] | "audit", number>;
  recentQueue: RuntimeQueueItem[];
  recentAudit: AuditEvent[];
  productionNotes: string[];
};

type DemoState = {
  queue: RuntimeQueueItem[];
  audit: AuditEvent[];
};

declare global {
  var __propertyPortalRuntimeState: DemoState | undefined;
}

const demoState = globalThis.__propertyPortalRuntimeState ??= {
  queue: [],
  audit: []
};

let sqlClient: postgres.Sql | undefined;

function organizationId() {
  return process.env.PROPERTY_OS_ORG_ID || "sample-org";
}

function demoRecord(item: RuntimeQueueItem, auditEvent?: AuditEvent): RuntimePersistenceReceipt {
  demoState.queue.unshift(item);
  demoState.queue = demoState.queue.slice(0, 50);
  if (auditEvent) {
    demoState.audit.unshift(auditEvent);
    demoState.audit = demoState.audit.slice(0, 50);
  }

  return {
    adapter: "demo-memory",
    status: "recorded",
    target: "process-memory",
    detail: "Recorded sanitized runtime summary in demo memory. This is not durable storage."
  };
}

function failureReceipt(adapter: RuntimePersistenceReceipt["adapter"], target: string): RuntimePersistenceReceipt {
  return {
    adapter,
    status: "failed",
    target,
    detail: "Runtime write failed. Keep the manual owner workflow active and inspect server logs."
  };
}

function getSql() {
  if (!process.env.DATABASE_URL) {
    return undefined;
  }

  sqlClient ??= postgres(process.env.DATABASE_URL, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10
  });

  return sqlClient;
}

async function withOrganizationContext<T>(
  sql: postgres.Sql,
  run: (scopedSql: postgres.Sql) => Promise<T>
): Promise<T> {
  const result = await sql.begin(async (transactionSql) => {
    await transactionSql`
      select set_config('property_os.organization_id', ${organizationId()}, true)
    `;
    return run(transactionSql as unknown as postgres.Sql);
  });
  return result as T;
}

async function getPropertyId(sql: postgres.Sql, propertySlug: string) {
  const rows = await sql<{ id: string }[]>`
    select id
    from properties
    where organization_id = ${organizationId()}
      and slug = ${propertySlug}
    limit 1
  `;
  if (!rows[0]?.id) {
    throw new Error("Property slug is not seeded in runtime database.");
  }
  return rows[0].id;
}

async function insertAudit(sql: postgres.Sql, event: AuditEvent, subjectType: string, subjectId: string) {
  await sql`
    insert into audit_events (id, organization_id, actor, event_type, subject_type, subject_id, metadata, created_at)
    values (
      ${event.id},
      ${organizationId()},
      ${event.actorRole},
      ${event.type},
      ${subjectType},
      ${subjectId},
      ${sql.json({ summary: event.summary })},
      ${event.createdAt}
    )
  `;
}

export async function persistInquiry(input: {
  payload: InquiryPayload;
  item: RuntimeQueueItem;
  auditEvent: AuditEvent;
}): Promise<RuntimePersistenceReceipt> {
  const sql = getSql();
  if (!sql) return demoRecord(input.item, input.auditEvent);

  try {
    await withOrganizationContext(sql, async (scopedSql) => {
      const propertyId = await getPropertyId(scopedSql, input.payload.propertySlug);
      await scopedSql`
        insert into inquiries (
          id, organization_id, property_id, status, requester_name, requester_email,
          rental_window, message_private, sanitized_summary, owner_approval_required, created_at, updated_at
        )
        values (
          ${input.item.id}, ${organizationId()}, ${propertyId}, 'owner-review',
          ${input.payload.name}, ${input.payload.email}, ${input.payload.rentalWindow},
          ${input.payload.message}, ${input.item.sanitizedSummary}, ${input.item.ownerApprovalRequired},
          ${input.item.createdAt}, ${input.item.createdAt}
        )
      `;
      await insertAudit(scopedSql, input.auditEvent, "inquiry", input.item.id);
    });
    return { adapter: "postgres", status: "recorded", target: "inquiries", detail: "Recorded inquiry in Postgres runtime storage." };
  } catch {
    return failureReceipt("postgres", "inquiries");
  }
}

export async function persistSupport(input: {
  payload: SupportPayload;
  item: RuntimeQueueItem;
  auditEvent: AuditEvent;
}): Promise<RuntimePersistenceReceipt> {
  const sql = getSql();
  if (!sql) return demoRecord(input.item, input.auditEvent);

  try {
    await withOrganizationContext(sql, async (scopedSql) => {
      const propertyId = await getPropertyId(scopedSql, input.payload.propertySlug);
      await scopedSql`
        insert into support_tickets (
          id, organization_id, property_id, category, urgency, route, status,
          message_private, sanitized_summary, owner_action, owner_approval_required, created_at, updated_at
        )
        values (
          ${input.item.id}, ${organizationId()}, ${propertyId}, ${input.payload.category},
          ${input.payload.urgency}, ${input.item.route}, 'owner-review',
          ${input.payload.message}, ${input.item.sanitizedSummary}, ${input.item.ownerAction},
          ${input.item.ownerApprovalRequired}, ${input.item.createdAt}, ${input.item.createdAt}
        )
      `;
      await insertAudit(scopedSql, input.auditEvent, "support_ticket", input.item.id);
    });
    return { adapter: "postgres", status: "recorded", target: "support_tickets", detail: "Recorded support ticket in Postgres runtime storage." };
  } catch {
    return failureReceipt("postgres", "support_tickets");
  }
}

export async function persistApproval(input: {
  approval: ApprovalRecord;
  auditEvent: AuditEvent;
}): Promise<RuntimePersistenceReceipt> {
  const item: RuntimeQueueItem = {
    id: input.approval.id,
    kind: "approval",
    route: input.approval.route,
    sanitizedSummary: `${input.approval.kind} approval requested for ${input.approval.sourceId}.`,
    ownerAction: input.approval.ownerAction,
    ownerApprovalRequired: true,
    createdAt: input.approval.createdAt
  };
  const sql = getSql();
  if (!sql) return demoRecord(item, input.auditEvent);

  try {
    await withOrganizationContext(sql, async (scopedSql) => {
      await scopedSql`
        insert into approvals (id, organization_id, subject_type, subject_id, status, requested_by, created_at)
        values (${input.approval.id}, ${organizationId()}, ${input.approval.kind}, ${input.approval.sourceId}, 'requested', 'system', ${input.approval.createdAt})
      `;
      await insertAudit(scopedSql, input.auditEvent, "approval", input.approval.id);
    });
    return { adapter: "postgres", status: "recorded", target: "approvals", detail: "Recorded approval request in Postgres runtime storage." };
  } catch {
    return failureReceipt("postgres", "approvals");
  }
}

export async function persistAgentRun(input: {
  id: string;
  payload: AgentRunPayload;
  route: string;
  ownerAction: string;
  sanitizedSummary: string;
  ownerApprovalRequired: boolean;
  auditEvent: AuditEvent;
}): Promise<RuntimePersistenceReceipt> {
  const item: RuntimeQueueItem = {
    id: input.id,
    kind: "agent-run",
    route: input.route,
    sanitizedSummary: input.sanitizedSummary,
    ownerAction: input.ownerAction,
    ownerApprovalRequired: input.ownerApprovalRequired,
    createdAt: input.auditEvent.createdAt
  };
  const sql = getSql();
  if (!sql) return demoRecord(item, input.auditEvent);

  try {
    await withOrganizationContext(sql, async (scopedSql) => {
      await scopedSql`
        insert into agent_runs (id, organization_id, role, trigger, output, approval_risk, owner_action, created_at)
        values (${input.id}, ${organizationId()}, ${input.payload.role}, ${input.payload.trigger}, ${input.payload.output}, ${input.payload.approvalRisk}, ${input.ownerAction}, ${input.auditEvent.createdAt})
      `;
      await insertAudit(scopedSql, input.auditEvent, "agent_run", input.id);
    });
    return { adapter: "postgres", status: "recorded", target: "agent_runs", detail: "Recorded agent run in Postgres runtime storage." };
  } catch {
    return failureReceipt("postgres", "agent_runs");
  }
}

export async function persistAgentMission(input: {
  mission: AgentMission;
  auditEvent: AuditEvent;
}): Promise<RuntimePersistenceReceipt> {
  const item: RuntimeQueueItem = {
    id: input.mission.id,
    kind: "agent-mission",
    route: "owner-mission-review",
    sanitizedSummary: `${input.mission.role} mission planned against ${input.mission.successMetric}.`,
    ownerAction: input.mission.ownerAction,
    ownerApprovalRequired: true,
    createdAt: input.mission.createdAt
  };
  const sql = getSql();
  if (!sql) return demoRecord(item, input.auditEvent);

  try {
    await withOrganizationContext(sql, async (scopedSql) => {
      await scopedSql`
        insert into agent_missions (
          id, organization_id, role, property_slug, objective, success_metric,
          status, authority, stages, owner_action, created_at, updated_at
        )
        values (
          ${input.mission.id}, ${organizationId()}, ${input.mission.role}, ${input.mission.propertySlug},
          ${input.mission.objective}, ${input.mission.successMetric}, ${input.mission.status},
          ${input.mission.authority}, ${scopedSql.json(input.mission.stages)}, ${input.mission.ownerAction},
          ${input.mission.createdAt}, ${input.mission.createdAt}
        )
      `;
      await insertAudit(scopedSql, input.auditEvent, "agent_mission", input.mission.id);
    });
    return { adapter: "postgres", status: "recorded", target: "agent_missions", detail: "Recorded agent mission in Postgres runtime storage." };
  } catch {
    return failureReceipt("postgres", "agent_missions");
  }
}

export async function persistListingDryRun(input: {
  id: string;
  payload: ListingDryRunPayload;
  route: string;
  ownerAction: string;
  sanitizedSummary: string;
  auditEvent: AuditEvent;
}): Promise<RuntimePersistenceReceipt> {
  const item: RuntimeQueueItem = {
    id: input.id,
    kind: "listing-dry-run",
    route: input.route,
    sanitizedSummary: input.sanitizedSummary,
    ownerAction: input.ownerAction,
    ownerApprovalRequired: true,
    createdAt: input.auditEvent.createdAt
  };
  const sql = getSql();
  if (!sql) return demoRecord(item, input.auditEvent);

  try {
    await withOrganizationContext(sql, async (scopedSql) => {
      await insertAudit(scopedSql, input.auditEvent, "listing_dry_run", input.id);
    });
    return { adapter: "postgres", status: "recorded", target: "audit_events", detail: "Recorded listing dry-run audit event in Postgres runtime storage." };
  } catch {
    return failureReceipt("postgres", "audit_events");
  }
}

export async function persistNotification(item: RuntimeQueueItem): Promise<RuntimePersistenceReceipt> {
  const sql = getSql();
  if (!sql) return demoRecord(item);

  try {
    await withOrganizationContext(sql, async (scopedSql) => {
      await scopedSql`
        insert into audit_events (id, organization_id, actor, event_type, subject_type, subject_id, metadata, created_at)
        values (
          ${item.id},
          ${organizationId()},
          'system',
          'owner_notification.queued',
          'notification',
          ${item.id},
          ${scopedSql.json({
            route: item.route,
            sanitizedSummary: item.sanitizedSummary,
            ownerAction: item.ownerAction,
            ownerApprovalRequired: item.ownerApprovalRequired
          })},
          ${item.createdAt}
        )
      `;
    });
    return {
      adapter: "postgres",
      status: "recorded",
      target: "audit_events",
      detail: "Recorded sanitized notification handoff in Postgres audit events."
    };
  } catch {
    return failureReceipt("postgres", "audit_events");
  }
}

export async function runtimeSnapshot(): Promise<RuntimeSnapshot> {
  const health = runtimeHealth();
  const sql = getSql();
  if (!sql) {
    const counts = demoState.queue.reduce<RuntimeSnapshot["counts"]>((acc, item) => {
      acc[item.kind] += 1;
      return acc;
    }, { inquiry: 0, support: 0, approval: 0, "agent-mission": 0, "agent-run": 0, "listing-dry-run": 0, notification: 0, audit: demoState.audit.length });

    return {
      health,
      counts,
      recentQueue: demoState.queue.slice(0, 12),
      recentAudit: demoState.audit.slice(0, 12),
      productionNotes: [
        "Demo memory is useful for local smoke tests only.",
        "Set DATABASE_URL and seed organizations/properties before handling real renter data.",
        "Use owner approval for every consequential action."
      ]
    };
  }

  try {
    const [inquiries, support, approvals, agentMissions, agentRuns, notifications, listingDryRuns, audit] = await withOrganizationContext(
      sql,
      async (scopedSql) => Promise.all([
        scopedSql`select count(*)::int as count from inquiries where organization_id = ${organizationId()}`,
        scopedSql`select count(*)::int as count from support_tickets where organization_id = ${organizationId()}`,
        scopedSql`select count(*)::int as count from approvals where organization_id = ${organizationId()}`,
        scopedSql`select count(*)::int as count from agent_missions where organization_id = ${organizationId()}`,
        scopedSql`select count(*)::int as count from agent_runs where organization_id = ${organizationId()}`,
        scopedSql`select count(*)::int as count from audit_events where organization_id = ${organizationId()} and subject_type = 'notification'`,
        scopedSql`select count(*)::int as count from audit_events where organization_id = ${organizationId()} and subject_type = 'listing_dry_run'`,
        scopedSql`select count(*)::int as count from audit_events where organization_id = ${organizationId()}`
      ])
    );

    return {
      health,
      counts: {
        inquiry: inquiries[0]?.count ?? 0,
        support: support[0]?.count ?? 0,
        approval: approvals[0]?.count ?? 0,
        "agent-mission": agentMissions[0]?.count ?? 0,
        "agent-run": agentRuns[0]?.count ?? 0,
        "listing-dry-run": listingDryRuns[0]?.count ?? 0,
        notification: notifications[0]?.count ?? 0,
        audit: audit[0]?.count ?? 0
      },
      recentQueue: [],
      recentAudit: [],
      productionNotes: [
        "Postgres is configured. Verify auth, row-level security, backups, and retention before production.",
        "Runtime snapshot intentionally returns counts only from database mode.",
        "Use audit_events for detailed operator inspection inside the private admin environment."
      ]
    };
  } catch {
    return {
      health,
      counts: { inquiry: 0, support: 0, approval: 0, "agent-mission": 0, "agent-run": 0, "listing-dry-run": 0, notification: 0, audit: 0 },
      recentQueue: [],
      recentAudit: [],
      productionNotes: [
        "DATABASE_URL is present, but runtime snapshot queries failed.",
        "Apply db/schema.sql, seed organization/property records, and check database permissions."
      ]
    };
  }
}
