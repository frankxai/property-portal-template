import postgres from "postgres";
import type { AgentMission, AgentRunPayload, ApprovalRecord, AuditEvent, ListingDryRunPayload } from "@/lib/runtime-contracts";
import { createAuditEvent, createRuntimeId, runtimeHealth } from "@/lib/runtime-contracts";
import { notificationPolicy, retryAt, type NotificationAction, type NotificationDelivery } from "@/lib/notification-policy";
import {
  buildWeeklyMetricObservations,
  currentWeekOf,
  type WeeklyMetricObservation,
  type WeeklyOwnerReview,
  type WeeklyReviewCompletionInput
} from "@/lib/weekly-review";
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
  recentNotifications: NotificationDelivery[];
  notificationSummary: {
    queued: number;
    urgentUnacknowledged: number;
    failures: number;
    acknowledged: number;
  };
  productionNotes: string[];
};

type DemoState = {
  queue: RuntimeQueueItem[];
  audit: AuditEvent[];
  notifications: NotificationDelivery[];
  weeklyReviews: WeeklyOwnerReview[];
};

declare global {
  var __propertyPortalRuntimeState: DemoState | undefined;
}

const demoState = globalThis.__propertyPortalRuntimeState ??= {
  queue: [],
  audit: [],
  notifications: [],
  weeklyReviews: []
};
demoState.notifications ??= [];
demoState.weeklyReviews ??= [];

let sqlClient: postgres.Sql | undefined;

function organizationId() {
  return process.env.PROPERTY_OS_ORG_ID || "sample-org";
}

export function demoRuntimeAllowed(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "production") return true;
  if (env.PROPERTY_OS_DEMO_RUNTIME !== "true") return false;
  try {
    const hostname = new URL(env.APP_BASE_URL || "").hostname;
    return ["127.0.0.1", "localhost", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

function demoRecord(item: RuntimeQueueItem, auditEvent?: AuditEvent): RuntimePersistenceReceipt {
  if (!demoRuntimeAllowed()) return failureReceipt("demo-memory", "durable-runtime-required");
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

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function notificationFromRow(row: Record<string, unknown>): NotificationDelivery {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    kind: row.kind as NotificationDelivery["kind"],
    urgency: row.urgency as NotificationDelivery["urgency"],
    route: String(row.route),
    sanitizedSummary: String(row.sanitized_summary),
    ownerAction: String(row.owner_action),
    payloadHash: String(row.payload_hash),
    status: row.status as NotificationDelivery["status"],
    primaryTarget: row.primary_target as NotificationDelivery["primaryTarget"],
    fallbackTarget: row.fallback_target as NotificationDelivery["fallbackTarget"],
    primaryAttemptCount: Number(row.primary_attempt_count),
    fallbackAttemptCount: Number(row.fallback_attempt_count),
    processingAction: row.processing_action ? row.processing_action as NotificationAction : null,
    nextAttemptAt: toIso(row.next_attempt_at as Date | string | null),
    claimUntil: toIso(row.claim_until as Date | string | null),
    lastAttemptAt: toIso(row.last_attempt_at as Date | string | null),
    deliveredAt: toIso(row.delivered_at as Date | string | null),
    fallbackDeliveredAt: toIso(row.fallback_delivered_at as Date | string | null),
    acknowledgedAt: toIso(row.acknowledged_at as Date | string | null),
    acknowledgedBy: row.acknowledged_by ? String(row.acknowledged_by) : null,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
    createdAt: toIso(row.created_at as Date | string) as string,
    updatedAt: toIso(row.updated_at as Date | string) as string
  };
}

function dateOnly(value: Date | string | null | undefined) {
  if (!value) return null;
  return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);
}

function weeklyObservationFromRow(row: Record<string, unknown>): WeeklyMetricObservation {
  return {
    id: String(row.id),
    metricId: row.metric_id as WeeklyMetricObservation["metricId"],
    label: String(row.label),
    value: row.value_numeric === null || row.value_numeric === undefined ? null : Number(row.value_numeric),
    unit: row.unit as WeeklyMetricObservation["unit"],
    target: String(row.target),
    status: row.status as WeeklyMetricObservation["status"],
    source: row.source as WeeklyMetricObservation["source"],
    evidenceRef: String(row.evidence_ref),
    observedAt: toIso(row.observed_at as Date | string) as string
  };
}

function weeklyReviewFromRow(row: Record<string, unknown>, observations: WeeklyMetricObservation[] = []): WeeklyOwnerReview {
  return {
    id: String(row.id),
    weekOf: dateOnly(row.week_of as Date | string) as string,
    status: row.status as WeeklyOwnerReview["status"],
    startedAt: toIso(row.started_at as Date | string) as string,
    completedAt: toIso(row.completed_at as Date | string | null),
    durationMinutes: row.duration_minutes === null || row.duration_minutes === undefined ? null : Number(row.duration_minutes),
    repeatedQuestionsTotal: row.repeated_questions_total === null || row.repeated_questions_total === undefined ? null : Number(row.repeated_questions_total),
    repeatedQuestionsCovered: row.repeated_questions_covered === null || row.repeated_questions_covered === undefined ? null : Number(row.repeated_questions_covered),
    knownVacancyDate: dateOnly(row.known_vacancy_date as Date | string | null),
    listingReadyDate: dateOnly(row.listing_ready_date as Date | string | null),
    keepNote: row.keep_note ? String(row.keep_note) : "",
    changeNote: row.change_note ? String(row.change_note) : "",
    stopNote: row.stop_note ? String(row.stop_note) : "",
    observations,
    createdAt: toIso(row.created_at as Date | string) as string,
    updatedAt: toIso(row.updated_at as Date | string) as string
  };
}

function notificationQueueItem(delivery: NotificationDelivery): RuntimeQueueItem {
  return {
    id: delivery.id,
    kind: "notification",
    route: delivery.route,
    sanitizedSummary: `${delivery.kind}: ${delivery.sanitizedSummary}`,
    ownerAction: delivery.ownerAction,
    ownerApprovalRequired: true,
    createdAt: delivery.createdAt
  };
}

function notificationSummary(deliveries: NotificationDelivery[]) {
  return {
    queued: deliveries.filter((item) => ["queued", "processing", "failed", "fallback-required", "fallback-failed"].includes(item.status)).length,
    urgentUnacknowledged: deliveries.filter((item) => item.urgency === "urgent" && item.status !== "acknowledged").length,
    failures: deliveries.filter((item) => ["failed", "fallback-required", "fallback-failed"].includes(item.status)).length,
    acknowledged: deliveries.filter((item) => item.status === "acknowledged").length
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

type InquiryPersistenceInput = {
  payload: InquiryPayload;
  item: RuntimeQueueItem;
  auditEvent: AuditEvent;
};

type SupportPersistenceInput = {
  payload: SupportPayload;
  item: RuntimeQueueItem;
  auditEvent: AuditEvent;
};

type ApprovalPersistenceInput = {
  approval: ApprovalRecord;
  auditEvent: AuditEvent;
};

function approvalQueueItem(input: ApprovalPersistenceInput): RuntimeQueueItem {
  return {
    id: input.approval.id,
    kind: "approval",
    route: input.approval.route,
    sanitizedSummary: `${input.approval.kind} approval requested for ${input.approval.sourceId}.`,
    ownerAction: input.approval.ownerAction,
    ownerApprovalRequired: true,
    createdAt: input.approval.createdAt
  };
}

async function insertInquiryRecord(sql: postgres.Sql, input: InquiryPersistenceInput) {
  const propertyId = await getPropertyId(sql, input.payload.propertySlug);
  await sql`
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
  await insertAudit(sql, input.auditEvent, "inquiry", input.item.id);
}

async function insertSupportRecord(sql: postgres.Sql, input: SupportPersistenceInput) {
  const propertyId = await getPropertyId(sql, input.payload.propertySlug);
  await sql`
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
  await insertAudit(sql, input.auditEvent, "support_ticket", input.item.id);
}

async function insertApprovalRecord(sql: postgres.Sql, input: ApprovalPersistenceInput) {
  await sql`
    insert into approvals (id, organization_id, subject_type, subject_id, status, requested_by, created_at)
    values (${input.approval.id}, ${organizationId()}, ${input.approval.kind}, ${input.approval.sourceId}, 'requested', 'system', ${input.approval.createdAt})
  `;
  await insertAudit(sql, input.auditEvent, "approval", input.approval.id);
}

export async function persistInquiry(input: InquiryPersistenceInput): Promise<RuntimePersistenceReceipt> {
  const sql = getSql();
  if (!sql) return demoRecord(input.item, input.auditEvent);

  try {
    await withOrganizationContext(sql, (scopedSql) => insertInquiryRecord(scopedSql, input));
    return { adapter: "postgres", status: "recorded", target: "inquiries", detail: "Recorded inquiry in Postgres runtime storage." };
  } catch {
    return failureReceipt("postgres", "inquiries");
  }
}

export async function persistSupport(input: SupportPersistenceInput): Promise<RuntimePersistenceReceipt> {
  const sql = getSql();
  if (!sql) return demoRecord(input.item, input.auditEvent);

  try {
    await withOrganizationContext(sql, (scopedSql) => insertSupportRecord(scopedSql, input));
    return { adapter: "postgres", status: "recorded", target: "support_tickets", detail: "Recorded support ticket in Postgres runtime storage." };
  } catch {
    return failureReceipt("postgres", "support_tickets");
  }
}

export async function persistApproval(input: ApprovalPersistenceInput): Promise<RuntimePersistenceReceipt> {
  const item = approvalQueueItem(input);
  const sql = getSql();
  if (!sql) return demoRecord(item, input.auditEvent);

  try {
    await withOrganizationContext(sql, (scopedSql) => insertApprovalRecord(scopedSql, input));
    return { adapter: "postgres", status: "recorded", target: "approvals", detail: "Recorded approval request in Postgres runtime storage." };
  } catch {
    return failureReceipt("postgres", "approvals");
  }
}

type IntakePersistenceResult = {
  persistence: RuntimePersistenceReceipt;
  approvalPersistence: RuntimePersistenceReceipt;
};

type IntakeApprovalInput = {
  approval: ApprovalRecord;
  approvalAuditEvent: AuditEvent;
};

export async function persistInquiryIntake(
  input: InquiryPersistenceInput & IntakeApprovalInput
): Promise<IntakePersistenceResult> {
  const approvalInput = { approval: input.approval, auditEvent: input.approvalAuditEvent };
  const sql = getSql();
  if (!sql) {
    const persistence = demoRecord(input.item, input.auditEvent);
    const approvalPersistence = persistence.status === "recorded"
      ? demoRecord(approvalQueueItem(approvalInput), input.approvalAuditEvent)
      : failureReceipt("demo-memory", "durable-runtime-required");
    return { persistence, approvalPersistence };
  }
  try {
    await withOrganizationContext(sql, async (scopedSql) => {
      await insertInquiryRecord(scopedSql, input);
      await insertApprovalRecord(scopedSql, approvalInput);
    });
    return {
      persistence: { adapter: "postgres", status: "recorded", target: "inquiries", detail: "Recorded inquiry and approval atomically in Postgres runtime storage." },
      approvalPersistence: { adapter: "postgres", status: "recorded", target: "approvals", detail: "Recorded inquiry and approval atomically in Postgres runtime storage." }
    };
  } catch {
    return {
      persistence: failureReceipt("postgres", "inquiries"),
      approvalPersistence: failureReceipt("postgres", "approvals")
    };
  }
}

export async function persistSupportIntake(
  input: SupportPersistenceInput & IntakeApprovalInput
): Promise<IntakePersistenceResult> {
  const approvalInput = { approval: input.approval, auditEvent: input.approvalAuditEvent };
  const sql = getSql();
  if (!sql) {
    const persistence = demoRecord(input.item, input.auditEvent);
    const approvalPersistence = persistence.status === "recorded"
      ? demoRecord(approvalQueueItem(approvalInput), input.approvalAuditEvent)
      : failureReceipt("demo-memory", "durable-runtime-required");
    return { persistence, approvalPersistence };
  }
  try {
    await withOrganizationContext(sql, async (scopedSql) => {
      await insertSupportRecord(scopedSql, input);
      await insertApprovalRecord(scopedSql, approvalInput);
    });
    return {
      persistence: { adapter: "postgres", status: "recorded", target: "support_tickets", detail: "Recorded support ticket and approval atomically in Postgres runtime storage." },
      approvalPersistence: { adapter: "postgres", status: "recorded", target: "approvals", detail: "Recorded support ticket and approval atomically in Postgres runtime storage." }
    };
  } catch {
    return {
      persistence: failureReceipt("postgres", "support_tickets"),
      approvalPersistence: failureReceipt("postgres", "approvals")
    };
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

async function insertNotificationEvent(
  sql: postgres.Sql,
  delivery: NotificationDelivery,
  input: {
    eventType: "queued" | "claimed" | "delivery-succeeded" | "delivery-failed" | "fallback-required" | "fallback-succeeded" | "fallback-failed" | "acknowledged";
    action?: NotificationAction | null;
    attemptNumber?: number | null;
    provider: "none" | "webhook" | "fallback-webhook" | "owner-portal";
    errorCode?: string | null;
    occurredAt: string;
  }
) {
  await sql`
    insert into notification_events (
      id, organization_id, notification_id, event_type, action, attempt_number,
      provider, payload_hash, error_code, metadata, occurred_at
    ) values (
      ${createRuntimeId("notif-event")}, ${organizationId()}, ${delivery.id}, ${input.eventType},
      ${input.action ?? null}, ${input.attemptNumber ?? null}, ${input.provider},
      ${delivery.payloadHash}, ${input.errorCode ?? null},
      ${sql.json({ urgency: delivery.urgency, route: delivery.route, status: delivery.status })},
      ${input.occurredAt}
    )
  `;
}

export async function persistNotification(delivery: NotificationDelivery): Promise<RuntimePersistenceReceipt> {
  const sql = getSql();
  if (!sql) {
    demoState.notifications.unshift(delivery);
    demoState.notifications = demoState.notifications.slice(0, 100);
    return demoRecord(notificationQueueItem(delivery));
  }

  try {
    await withOrganizationContext(sql, async (scopedSql) => {
      await scopedSql`
        insert into notification_deliveries (
          id, organization_id, source_id, kind, urgency, route, sanitized_summary,
          owner_action, payload_hash, status, primary_target, fallback_target,
          primary_attempt_count, fallback_attempt_count, processing_action,
          next_attempt_at, claim_until, last_attempt_at, delivered_at,
          fallback_delivered_at, acknowledged_at, acknowledged_by, last_error_code,
          created_at, updated_at
        )
        values (
          ${delivery.id}, ${organizationId()}, ${delivery.sourceId}, ${delivery.kind},
          ${delivery.urgency}, ${delivery.route}, ${delivery.sanitizedSummary},
          ${delivery.ownerAction}, ${delivery.payloadHash}, ${delivery.status},
          ${delivery.primaryTarget}, ${delivery.fallbackTarget},
          ${delivery.primaryAttemptCount}, ${delivery.fallbackAttemptCount},
          ${delivery.processingAction}, ${delivery.nextAttemptAt}, ${delivery.claimUntil},
          ${delivery.lastAttemptAt}, ${delivery.deliveredAt}, ${delivery.fallbackDeliveredAt},
          ${delivery.acknowledgedAt}, ${delivery.acknowledgedBy}, ${delivery.lastErrorCode},
          ${delivery.createdAt}, ${delivery.updatedAt}
        )
      `;
      await insertNotificationEvent(scopedSql, delivery, {
        eventType: "queued",
        provider: "none",
        occurredAt: delivery.createdAt
      });
    });
    return {
      adapter: "postgres",
      status: "recorded",
      target: "notification_deliveries",
      detail: "Recorded sanitized notification in the durable outbox before delivery."
    };
  } catch {
    return failureReceipt("postgres", "notification_deliveries");
  }
}

export async function listNotificationDeliveries(limit = 25): Promise<NotificationDelivery[]> {
  const boundedLimit = Math.max(1, Math.min(limit, 100));
  const sql = getSql();
  if (!sql) return demoState.notifications.slice(0, boundedLimit);

  try {
    const rows = await withOrganizationContext(sql, (scopedSql) => scopedSql`
      select *
      from notification_deliveries
      where organization_id = ${organizationId()}
      order by created_at desc
      limit ${boundedLimit}
    `);
    return rows.map((row) => notificationFromRow(row));
  } catch {
    throw new Error("Notification delivery ledger unavailable.");
  }
}

function dueNotificationAction(delivery: NotificationDelivery, now: Date, acknowledgementCutoff: Date, maxAttempts: number) {
  const nextAttemptDue = !delivery.nextAttemptAt || new Date(delivery.nextAttemptAt) <= now;
  if (delivery.status === "processing" && delivery.claimUntil && new Date(delivery.claimUntil) <= now) {
    return delivery.processingAction;
  }
  if (["queued", "failed"].includes(delivery.status) && delivery.primaryAttemptCount < maxAttempts && nextAttemptDue) {
    return "send-primary" as const;
  }
  if (
    ["fallback-required", "fallback-failed"].includes(delivery.status) &&
    delivery.fallbackTarget !== "none" &&
    delivery.fallbackAttemptCount < maxAttempts &&
    nextAttemptDue
  ) {
    return "send-fallback" as const;
  }
  if (
    delivery.status === "sent" &&
    delivery.urgency === "urgent" &&
    delivery.deliveredAt &&
    new Date(delivery.deliveredAt) <= acknowledgementCutoff
  ) {
    return "send-fallback" as const;
  }
  return null;
}

export async function claimDueNotificationDeliveries(input: {
  now?: Date;
  limit?: number;
} = {}): Promise<Array<NotificationDelivery & { claimedAction: NotificationAction }>> {
  const policy = notificationPolicy();
  const now = input.now ?? new Date();
  const limit = Math.max(1, Math.min(input.limit ?? policy.batchSize, policy.batchSize));
  const claimUntil = new Date(now.getTime() + policy.claimLeaseMs).toISOString();
  const acknowledgementCutoff = new Date(now.getTime() - policy.acknowledgementTimeoutMs);
  const sql = getSql();

  if (!sql) {
    const claims: Array<NotificationDelivery & { claimedAction: NotificationAction }> = [];
    for (const delivery of demoState.notifications) {
      if (claims.length >= limit) break;
      const action = dueNotificationAction(delivery, now, acknowledgementCutoff, policy.maxAttempts);
      if (!action) continue;
      delivery.status = "processing";
      delivery.processingAction = action;
      delivery.claimUntil = claimUntil;
      delivery.updatedAt = now.toISOString();
      claims.push({ ...delivery, claimedAction: action });
    }
    return claims;
  }

  try {
    return await withOrganizationContext(sql, async (scopedSql) => {
      const rows = await scopedSql`
        with due as (
          select id,
            case
              when status = 'processing' then processing_action
              when status in ('queued', 'failed') then 'send-primary'
              else 'send-fallback'
            end as claimed_action
          from notification_deliveries
          where organization_id = ${organizationId()}
            and (
              (status in ('queued', 'failed')
                and primary_attempt_count < ${policy.maxAttempts}
                and (next_attempt_at is null or next_attempt_at <= ${now.toISOString()}))
              or
              (status in ('fallback-required', 'fallback-failed')
                and fallback_target <> 'none'
                and fallback_attempt_count < ${policy.maxAttempts}
                and (next_attempt_at is null or next_attempt_at <= ${now.toISOString()}))
              or
              (status = 'sent'
                and urgency = 'urgent'
                and delivered_at <= ${acknowledgementCutoff.toISOString()})
              or
              (status = 'processing' and claim_until <= ${now.toISOString()})
            )
          order by case when urgency = 'urgent' then 0 else 1 end, created_at
          for update skip locked
          limit ${limit}
        )
        update notification_deliveries as delivery
        set status = 'processing',
            processing_action = due.claimed_action,
            claim_until = ${claimUntil},
            updated_at = ${now.toISOString()}
        from due
        where delivery.id = due.id
        returning delivery.*
      `;

      const claims = rows.map((row) => ({
        ...notificationFromRow(row),
        claimedAction: row.processing_action as NotificationAction
      }));
      for (const delivery of claims) {
        await insertNotificationEvent(scopedSql, delivery, {
          eventType: "claimed",
          action: delivery.claimedAction,
          provider: "none",
          occurredAt: now.toISOString()
        });
      }
      return claims;
    });
  } catch {
    throw new Error("Notification outbox claim failed.");
  }
}

type NotificationCompletion = {
  id: string;
  action: NotificationAction;
  succeeded: boolean;
  providerConfigured: boolean;
  errorCode?: string | null;
  now?: Date;
};

function completedDelivery(
  current: NotificationDelivery,
  input: NotificationCompletion
): { delivery: NotificationDelivery; eventType: "delivery-succeeded" | "delivery-failed" | "fallback-required" | "fallback-succeeded" | "fallback-failed"; attemptNumber: number; provider: "none" | "webhook" | "fallback-webhook" } {
  const policy = notificationPolicy();
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const delivery = { ...current, processingAction: null, claimUntil: null, lastAttemptAt: timestamp, updatedAt: timestamp };

  if (input.action === "send-primary") {
    const attempts = current.primaryAttemptCount + (input.providerConfigured ? 1 : 0);
    delivery.primaryAttemptCount = attempts;
    if (input.succeeded) {
      delivery.status = "sent";
      delivery.deliveredAt = timestamp;
      delivery.nextAttemptAt = null;
      delivery.lastErrorCode = null;
      return { delivery, eventType: "delivery-succeeded", attemptNumber: attempts, provider: "webhook" };
    }

    delivery.lastErrorCode = input.errorCode ?? (input.providerConfigured ? "delivery-failed" : "provider-not-configured");
    if (current.urgency === "urgent" && (!input.providerConfigured || attempts >= policy.maxAttempts)) {
      delivery.status = "fallback-required";
      delivery.nextAttemptAt = current.fallbackTarget === "none" ? null : timestamp;
      return { delivery, eventType: "fallback-required", attemptNumber: attempts, provider: input.providerConfigured ? "webhook" : "none" };
    }

    delivery.status = "failed";
    delivery.nextAttemptAt = input.providerConfigured && attempts < policy.maxAttempts ? retryAt(now, attempts, policy) : null;
    return { delivery, eventType: "delivery-failed", attemptNumber: attempts, provider: input.providerConfigured ? "webhook" : "none" };
  }

  const attempts = current.fallbackAttemptCount + (input.providerConfigured ? 1 : 0);
  delivery.fallbackAttemptCount = attempts;
  if (input.succeeded) {
    delivery.status = "fallback-sent";
    delivery.fallbackDeliveredAt = timestamp;
    delivery.nextAttemptAt = null;
    delivery.lastErrorCode = null;
    return { delivery, eventType: "fallback-succeeded", attemptNumber: attempts, provider: "fallback-webhook" };
  }

  delivery.lastErrorCode = input.errorCode ?? (input.providerConfigured ? "fallback-failed" : "fallback-not-configured");
  delivery.status = input.providerConfigured ? "fallback-failed" : "fallback-required";
  delivery.nextAttemptAt = input.providerConfigured && attempts < policy.maxAttempts ? retryAt(now, attempts, policy) : null;
  return {
    delivery,
    eventType: input.providerConfigured ? "fallback-failed" : "fallback-required",
    attemptNumber: attempts,
    provider: input.providerConfigured ? "fallback-webhook" : "none"
  };
}

export async function completeNotificationDelivery(input: NotificationCompletion): Promise<NotificationDelivery | null> {
  const sql = getSql();
  if (!sql) {
    const index = demoState.notifications.findIndex((item) => item.id === input.id);
    if (index < 0) return null;
    const current = demoState.notifications[index];
    if (current.status !== "processing" || current.processingAction !== input.action) return current;
    const completed = completedDelivery(current, input).delivery;
    demoState.notifications[index] = completed;
    return completed;
  }

  try {
    return await withOrganizationContext(sql, async (scopedSql) => {
      const rows = await scopedSql`
        select * from notification_deliveries
        where organization_id = ${organizationId()} and id = ${input.id}
        for update
      `;
      if (!rows[0]) return null;
      const current = notificationFromRow(rows[0]);
      if (current.status !== "processing" || current.processingAction !== input.action) return current;
      const completed = completedDelivery(current, input);
      const delivery = completed.delivery;
      await scopedSql`
        update notification_deliveries
        set status = ${delivery.status},
            primary_attempt_count = ${delivery.primaryAttemptCount},
            fallback_attempt_count = ${delivery.fallbackAttemptCount},
            processing_action = null,
            next_attempt_at = ${delivery.nextAttemptAt},
            claim_until = null,
            last_attempt_at = ${delivery.lastAttemptAt},
            delivered_at = ${delivery.deliveredAt},
            fallback_delivered_at = ${delivery.fallbackDeliveredAt},
            last_error_code = ${delivery.lastErrorCode},
            updated_at = ${delivery.updatedAt}
        where organization_id = ${organizationId()} and id = ${delivery.id}
      `;
      await insertNotificationEvent(scopedSql, delivery, {
        eventType: completed.eventType,
        action: input.action,
        attemptNumber: completed.attemptNumber,
        provider: completed.provider,
        errorCode: delivery.lastErrorCode,
        occurredAt: delivery.updatedAt
      });
      return delivery;
    });
  } catch {
    return null;
  }
}

export async function acknowledgeNotificationDelivery(id: string, acknowledgedBy: string) {
  const now = new Date().toISOString();
  const sql = getSql();
  if (!sql) {
    const delivery = demoState.notifications.find((item) => item.id === id);
    if (!delivery) return { delivery: null, changed: false };
    if (delivery.status === "acknowledged") return { delivery, changed: false };
    delivery.status = "acknowledged";
    delivery.acknowledgedAt = now;
    delivery.acknowledgedBy = acknowledgedBy;
    delivery.processingAction = null;
    delivery.nextAttemptAt = null;
    delivery.claimUntil = null;
    delivery.updatedAt = now;
    return { delivery: { ...delivery }, changed: true };
  }

  try {
    return await withOrganizationContext(sql, async (scopedSql) => {
      const rows = await scopedSql`
        select * from notification_deliveries
        where organization_id = ${organizationId()} and id = ${id}
        for update
      `;
      if (!rows[0]) return { delivery: null, changed: false };
      const current = notificationFromRow(rows[0]);
      if (current.status === "acknowledged") return { delivery: current, changed: false };
      const delivery: NotificationDelivery = {
        ...current,
        status: "acknowledged",
        acknowledgedAt: now,
        acknowledgedBy,
        processingAction: null,
        nextAttemptAt: null,
        claimUntil: null,
        updatedAt: now
      };
      await scopedSql`
        update notification_deliveries
        set status = 'acknowledged', acknowledged_at = ${now}, acknowledged_by = ${acknowledgedBy},
            processing_action = null, next_attempt_at = null, claim_until = null, updated_at = ${now}
        where organization_id = ${organizationId()} and id = ${id}
      `;
      await insertNotificationEvent(scopedSql, delivery, {
        eventType: "acknowledged",
        provider: "owner-portal",
        occurredAt: now
      });
      return { delivery, changed: true };
    });
  } catch {
    return { delivery: null, changed: false };
  }
}

function urgentAcknowledgementMinutes(
  deliveries: NotificationDelivery[],
  startedAt: string,
  completedAt: string
) {
  const values = deliveries
    .filter((item) => (
      item.urgency === "urgent" &&
      item.acknowledgedAt &&
      item.createdAt >= startedAt &&
      item.createdAt <= completedAt
    ))
    .map((item) => (new Date(item.acknowledgedAt as string).valueOf() - new Date(item.createdAt).valueOf()) / 60_000)
    .filter((value) => Number.isFinite(value) && value >= 0);
  return values.length > 0 ? Math.round(Math.max(...values) * 10) / 10 : null;
}

export async function listWeeklyOwnerReviews(limit = 12): Promise<WeeklyOwnerReview[]> {
  const boundedLimit = Math.max(1, Math.min(limit, 52));
  const sql = getSql();
  if (!sql) return demoState.weeklyReviews.slice(0, boundedLimit);

  try {
    return await withOrganizationContext(sql, async (scopedSql) => {
      const rows = await scopedSql`
        select *
        from weekly_owner_reviews
        where organization_id = ${organizationId()}
        order by week_of desc, created_at desc
        limit ${boundedLimit}
      `;
      const reviews: WeeklyOwnerReview[] = [];
      for (const row of rows) {
        const observationRows = await scopedSql`
          select * from weekly_metric_observations
          where organization_id = ${organizationId()} and weekly_review_id = ${String(row.id)}
          order by observed_at, metric_id
        `;
        reviews.push(weeklyReviewFromRow(row, observationRows.map((item) => weeklyObservationFromRow(item))));
      }
      return reviews;
    });
  } catch {
    throw new Error("Weekly owner review ledger unavailable.");
  }
}

export async function startWeeklyOwnerReview(now = new Date()) {
  const startedAt = now.toISOString();
  const weekOf = currentWeekOf(now);
  const sql = getSql();

  if (!sql) {
    const existing = demoState.weeklyReviews.find((item) => item.weekOf === weekOf);
    if (existing) {
      return {
        review: existing,
        changed: false,
        persistence: { adapter: "demo-memory", status: "recorded", target: "process-memory", detail: "Returned the existing weekly review from demo memory." } as RuntimePersistenceReceipt
      };
    }
    const review: WeeklyOwnerReview = {
      id: createRuntimeId("weekly"),
      weekOf,
      status: "in-progress",
      startedAt,
      completedAt: null,
      durationMinutes: null,
      repeatedQuestionsTotal: null,
      repeatedQuestionsCovered: null,
      knownVacancyDate: null,
      listingReadyDate: null,
      keepNote: "",
      changeNote: "",
      stopNote: "",
      observations: [],
      createdAt: startedAt,
      updatedAt: startedAt
    };
    demoState.weeklyReviews.unshift(review);
    const auditEvent = createAuditEvent({
      type: "weekly_review.started",
      actorRole: "owner",
      summary: `Weekly owner review started for ${weekOf}.`
    });
    demoState.audit.unshift(auditEvent);
    return {
      review,
      changed: true,
      persistence: { adapter: "demo-memory", status: "recorded", target: "process-memory", detail: "Recorded weekly review start in demo memory; this is not durable storage." } as RuntimePersistenceReceipt
    };
  }

  try {
    return await withOrganizationContext(sql, async (scopedSql) => {
      const id = createRuntimeId("weekly");
      const inserted = await scopedSql`
        insert into weekly_owner_reviews (
          id, organization_id, week_of, status, started_at, created_at, updated_at
        ) values (
          ${id}, ${organizationId()}, ${weekOf}, 'in-progress', ${startedAt}, ${startedAt}, ${startedAt}
        )
        on conflict (organization_id, week_of) do nothing
        returning *
      `;
      const rows = inserted.length > 0 ? inserted : await scopedSql`
        select * from weekly_owner_reviews
        where organization_id = ${organizationId()} and week_of = ${weekOf}
        limit 1
      `;
      if (!rows[0]) throw new Error("Weekly review start was not recorded.");
      if (inserted.length > 0) {
        await insertAudit(scopedSql, createAuditEvent({
          type: "weekly_review.started",
          actorRole: "owner",
          summary: `Weekly owner review started for ${weekOf}.`
        }), "weekly_owner_review", String(rows[0].id));
      }
      const review = weeklyReviewFromRow(rows[0]);
      return {
        review,
        changed: inserted.length > 0,
        persistence: { adapter: "postgres", status: "recorded", target: "weekly_owner_reviews", detail: inserted.length > 0 ? "Recorded a server-timestamped weekly review start." : "Returned the existing review for this week." } as RuntimePersistenceReceipt
      };
    });
  } catch {
    throw new Error("Weekly owner review start failed.");
  }
}

export async function completeWeeklyOwnerReview(
  id: string,
  input: WeeklyReviewCompletionInput,
  now = new Date()
) {
  const completedAt = now.toISOString();
  const sql = getSql();

  if (!sql) {
    const review = demoState.weeklyReviews.find((item) => item.id === id);
    if (!review) return { review: null, changed: false, persistence: failureReceipt("demo-memory", "weekly_owner_reviews") };
    if (review.status === "completed") {
      return { review, changed: false, persistence: { adapter: "demo-memory", status: "recorded", target: "process-memory", detail: "Weekly review was already completed." } as RuntimePersistenceReceipt };
    }
    const completedReview: WeeklyOwnerReview = {
      ...review,
      ...input,
      status: "completed",
      completedAt,
      updatedAt: completedAt
    };
    const metrics = buildWeeklyMetricObservations({
      review: completedReview,
      urgentAcknowledgementMinutes: urgentAcknowledgementMinutes(demoState.notifications, review.startedAt, completedAt),
      observedAt: completedAt,
      createId: () => createRuntimeId("metric")
    });
    completedReview.durationMinutes = metrics.durationMinutes;
    completedReview.observations = metrics.observations;
    Object.assign(review, completedReview);
    demoState.audit.unshift(createAuditEvent({
      type: "weekly_review.completed",
      actorRole: "owner",
      summary: `Weekly owner review completed for ${review.weekOf} with ${metrics.observations.filter((item) => item.status === "met").length} targets met.`
    }));
    return {
      review: completedReview,
      changed: true,
      persistence: { adapter: "demo-memory", status: "recorded", target: "process-memory", detail: "Recorded weekly review observations in demo memory; this is not durable storage." } as RuntimePersistenceReceipt
    };
  }

  try {
    return await withOrganizationContext(sql, async (scopedSql) => {
      const rows = await scopedSql`
        select * from weekly_owner_reviews
        where organization_id = ${organizationId()} and id = ${id}
        for update
      `;
      if (!rows[0]) return { review: null, changed: false, persistence: failureReceipt("postgres", "weekly_owner_reviews") };
      const current = weeklyReviewFromRow(rows[0]);
      if (current.status === "completed") {
        const observationRows = await scopedSql`
          select * from weekly_metric_observations
          where organization_id = ${organizationId()} and weekly_review_id = ${id}
          order by observed_at, metric_id
        `;
        current.observations = observationRows.map((row) => weeklyObservationFromRow(row));
        return { review: current, changed: false, persistence: { adapter: "postgres", status: "recorded", target: "weekly_owner_reviews", detail: "Weekly review was already completed." } as RuntimePersistenceReceipt };
      }

      const acknowledgementRows = await scopedSql`
        select max(extract(epoch from (acknowledged_at - created_at)) / 60.0)::float8 as minutes
        from notification_deliveries
        where organization_id = ${organizationId()}
          and urgency = 'urgent'
          and acknowledged_at is not null
          and created_at >= ${current.startedAt}
          and created_at <= ${completedAt}
      `;
      const urgentMinutes = acknowledgementRows[0]?.minutes === null || acknowledgementRows[0]?.minutes === undefined
        ? null
        : Math.round(Number(acknowledgementRows[0].minutes) * 10) / 10;
      const completedReview: WeeklyOwnerReview = {
        ...current,
        ...input,
        status: "completed",
        completedAt,
        updatedAt: completedAt
      };
      const metrics = buildWeeklyMetricObservations({
        review: completedReview,
        urgentAcknowledgementMinutes: urgentMinutes,
        observedAt: completedAt,
        createId: () => createRuntimeId("metric")
      });
      completedReview.durationMinutes = metrics.durationMinutes;
      completedReview.observations = metrics.observations;

      await scopedSql`
        update weekly_owner_reviews
        set status = 'completed', completed_at = ${completedAt}, duration_minutes = ${metrics.durationMinutes},
            repeated_questions_total = ${input.repeatedQuestionsTotal},
            repeated_questions_covered = ${input.repeatedQuestionsCovered},
            known_vacancy_date = ${input.knownVacancyDate}, listing_ready_date = ${input.listingReadyDate},
            keep_note = ${input.keepNote}, change_note = ${input.changeNote}, stop_note = ${input.stopNote},
            updated_at = ${completedAt}
        where organization_id = ${organizationId()} and id = ${id}
      `;
      for (const observation of metrics.observations) {
        await scopedSql`
          insert into weekly_metric_observations (
            id, organization_id, weekly_review_id, metric_id, label, value_numeric,
            unit, target, status, source, evidence_ref, observed_at
          ) values (
            ${observation.id}, ${organizationId()}, ${id}, ${observation.metricId}, ${observation.label},
            ${observation.value}, ${observation.unit}, ${observation.target}, ${observation.status},
            ${observation.source}, ${observation.evidenceRef}, ${observation.observedAt}
          )
        `;
      }
      await insertAudit(scopedSql, createAuditEvent({
        type: "weekly_review.completed",
        actorRole: "owner",
        summary: `Weekly owner review completed for ${current.weekOf} with ${metrics.observations.filter((item) => item.status === "met").length} targets met.`
      }), "weekly_owner_review", id);
      return {
        review: completedReview,
        changed: true,
        persistence: { adapter: "postgres", status: "recorded", target: "weekly_owner_reviews+weekly_metric_observations", detail: "Recorded the completed review and immutable metric observations in one transaction." } as RuntimePersistenceReceipt
      };
    });
  } catch {
    throw new Error("Weekly owner review completion failed.");
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
      recentNotifications: demoState.notifications.slice(0, 12),
      notificationSummary: notificationSummary(demoState.notifications),
      productionNotes: [
        "Demo memory is useful for local smoke tests only.",
        "Set DATABASE_URL and seed organizations/properties before handling real renter data.",
        "Use owner approval for every consequential action."
      ]
    };
  }

  try {
    const [inquiries, support, approvals, agentMissions, agentRuns, notifications, recentNotifications, notificationStatusCounts, listingDryRuns, audit] = await withOrganizationContext(
      sql,
      async (scopedSql) => Promise.all([
        scopedSql`select count(*)::int as count from inquiries where organization_id = ${organizationId()}`,
        scopedSql`select count(*)::int as count from support_tickets where organization_id = ${organizationId()}`,
        scopedSql`select count(*)::int as count from approvals where organization_id = ${organizationId()}`,
        scopedSql`select count(*)::int as count from agent_missions where organization_id = ${organizationId()}`,
        scopedSql`select count(*)::int as count from agent_runs where organization_id = ${organizationId()}`,
        scopedSql`select count(*)::int as count from notification_deliveries where organization_id = ${organizationId()}`,
        scopedSql`select * from notification_deliveries where organization_id = ${organizationId()} order by created_at desc limit 12`,
        scopedSql`
          select
            count(*) filter (where status in ('queued', 'processing', 'failed', 'fallback-required', 'fallback-failed'))::int as queued,
            count(*) filter (where urgency = 'urgent' and status <> 'acknowledged')::int as urgent_unacknowledged,
            count(*) filter (where status in ('failed', 'fallback-required', 'fallback-failed'))::int as failures,
            count(*) filter (where status = 'acknowledged')::int as acknowledged
          from notification_deliveries
          where organization_id = ${organizationId()}
        `,
        scopedSql`select count(*)::int as count from audit_events where organization_id = ${organizationId()} and subject_type = 'listing_dry_run'`,
        scopedSql`select count(*)::int as count from audit_events where organization_id = ${organizationId()}`
      ])
    );

    const mappedNotifications = recentNotifications.map((row) => notificationFromRow(row));
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
      recentNotifications: mappedNotifications,
      notificationSummary: {
        queued: notificationStatusCounts[0]?.queued ?? 0,
        urgentUnacknowledged: notificationStatusCounts[0]?.urgent_unacknowledged ?? 0,
        failures: notificationStatusCounts[0]?.failures ?? 0,
        acknowledged: notificationStatusCounts[0]?.acknowledged ?? 0
      },
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
      recentNotifications: [],
      notificationSummary: { queued: 0, urgentUnacknowledged: 0, failures: 0, acknowledged: 0 },
      productionNotes: [
        "DATABASE_URL is present, but runtime snapshot queries failed.",
        "Apply db/schema.sql, seed organization/property records, and check database permissions."
      ]
    };
  }
}
