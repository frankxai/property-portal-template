"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import type {
  OwnerInboxApprovalState,
  OwnerInboxDetail,
  OwnerInboxDetailResult,
  OwnerInboxDueState,
  OwnerInboxListItem,
  OwnerInboxSourceType,
  OwnerInboxStatus
} from "@/lib/owner-inbox";

type InboxFilters = {
  type: "all" | OwnerInboxSourceType;
  status: "all" | OwnerInboxStatus;
  urgency: "all" | "standard" | "urgent";
  due: "all" | OwnerInboxDueState;
};

type InboxForm = {
  status: OwnerInboxStatus;
  assigneeMemberId: string;
  dueAt: string;
  draftReply: string;
  draftApprovalState: OwnerInboxApprovalState;
};

const emptyFilters: InboxFilters = { type: "all", status: "all", urgency: "all", due: "all" };
const statusLabels: Record<OwnerInboxStatus, string> = {
  new: "New",
  triage: "Triage",
  "in-progress": "In progress",
  "waiting-owner": "Waiting owner",
  resolved: "Resolved",
  closed: "Closed"
};
const statusTransitions: Record<OwnerInboxStatus, OwnerInboxStatus[]> = {
  new: ["triage", "in-progress"],
  triage: ["new", "in-progress", "waiting-owner"],
  "in-progress": ["triage", "waiting-owner", "resolved"],
  "waiting-owner": ["in-progress", "resolved"],
  resolved: ["in-progress", "closed"],
  closed: ["in-progress"]
};

function itemKey(item: Pick<OwnerInboxListItem, "type" | "id">) {
  return `${item.type}:${item.id}`;
}

function readableDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.valueOf() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function dueTone(due: OwnerInboxDueState): "default" | "warning" | "danger" {
  if (due === "overdue") return "danger";
  if (due === "due-soon") return "warning";
  return "default";
}

function formFromDetail(item: OwnerInboxDetail): InboxForm {
  return {
    status: item.status,
    assigneeMemberId: item.assignee?.id || "",
    dueAt: localDateTime(item.dueAt),
    draftReply: item.draftReply,
    draftApprovalState: item.draftApprovalState
  };
}

function listItemFromDetail(item: OwnerInboxDetail): OwnerInboxListItem {
  return {
    id: item.id,
    type: item.type,
    status: item.status,
    urgency: item.urgency,
    createdAt: item.createdAt,
    property: item.property,
    sanitizedSummary: item.sanitizedSummary,
    ownerAction: item.ownerAction,
    assignee: item.assignee,
    dueAt: item.dueAt,
    dueState: item.dueState,
    draftApprovalState: item.draftApprovalState,
    version: item.version
  };
}

function requestPayload(detail: OwnerInboxDetail, form: InboxForm) {
  const payload: Record<string, unknown> = { expectedVersion: detail.version };
  if (form.status !== detail.status) payload.status = form.status;
  if (form.assigneeMemberId !== (detail.assignee?.id || "")) payload.assigneeMemberId = form.assigneeMemberId || null;
  const dueAt = form.dueAt ? new Date(form.dueAt).toISOString() : null;
  if (dueAt !== detail.dueAt) payload.dueAt = dueAt;
  if (form.draftReply !== detail.draftReply) payload.draftReply = form.draftReply;
  if (form.draftApprovalState !== detail.draftApprovalState) payload.draftApprovalState = form.draftApprovalState;
  return payload;
}

export function OwnerInbox({
  initialItems,
  initialError,
  canWrite,
  canClose,
  canApprove,
  actorRole
}: {
  initialItems: OwnerInboxListItem[];
  initialError: string;
  canWrite: boolean;
  canClose: boolean;
  canApprove: boolean;
  actorRole: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedKey, setSelectedKey] = useState(initialItems[0] ? itemKey(initialItems[0]) : "");
  const [detailResult, setDetailResult] = useState<OwnerInboxDetailResult | null>(null);
  const [form, setForm] = useState<InboxForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");

  const filteredItems = useMemo(() => items.filter((item) => (
    (filters.type === "all" || item.type === filters.type)
    && (filters.status === "all" || item.status === filters.status)
    && (filters.urgency === "all" || item.urgency === filters.urgency)
    && (filters.due === "all" || item.dueState === filters.due)
  )), [filters, items]);
  const selectedItem = items.find((item) => itemKey(item) === selectedKey) || null;
  const urgentCount = items.filter((item) => item.urgency === "urgent" && !["resolved", "closed"].includes(item.status)).length;
  const overdueCount = items.filter((item) => item.dueState === "overdue").length;
  const unassignedCount = items.filter((item) => !item.assignee && !["resolved", "closed"].includes(item.status)).length;

  useEffect(() => {
    if (!selectedKey || !selectedItem) {
      setDetailResult(null);
      setForm(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setNotice("");
    fetch(`/api/owner-inbox/${encodeURIComponent(selectedItem.type)}/${encodeURIComponent(selectedItem.id)}`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = await response.json() as OwnerInboxDetailResult & { error?: string };
        if (!response.ok || !payload.item) throw new Error(payload.error || "Inbox detail failed to load.");
        setDetailResult(payload);
        setForm(formFromDetail(payload.item));
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setDetailResult(null);
        setForm(null);
        setError(cause instanceof Error ? cause.message : "Inbox detail failed to load.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selectedKey, selectedItem?.id, selectedItem?.type]);

  function updateFilter<K extends keyof InboxFilters>(key: K, value: InboxFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function updateForm<K extends keyof InboxForm>(key: K, value: InboxForm[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailResult || !form || !canWrite) return;
    const payload = requestPayload(detailResult.item, form);
    if (Object.keys(payload).length === 1) {
      setNotice("No changes to record. External actions remain at zero.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/owner-inbox/${encodeURIComponent(detailResult.item.type)}/${encodeURIComponent(detailResult.item.id)}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json() as OwnerInboxDetailResult & { error?: string; externalActionCount?: number };
      if (!response.ok || !result.item) throw new Error(result.error || "Inbox update failed.");
      setDetailResult(result);
      setForm(formFromDetail(result.item));
      setItems((current) => current.map((item) => itemKey(item) === itemKey(result.item) ? listItemFromDetail(result.item) : item));
      setNotice(`Update recorded. ${result.externalActionCount ?? 0} external actions performed.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inbox update failed.");
    } finally {
      setSaving(false);
    }
  }

  const statusOptions = detailResult
    ? [detailResult.item.status, ...statusTransitions[detailResult.item.status]]
    : [];

  return (
    <section className="owner-inbox-console" aria-live="polite">
      <div className="owner-inbox-metrics" aria-label="Queue summary">
        <div><span>Open</span><strong>{items.filter((item) => !["resolved", "closed"].includes(item.status)).length}</strong></div>
        <div><span>Urgent</span><strong>{urgentCount}</strong></div>
        <div><span>Overdue</span><strong>{overdueCount}</strong></div>
        <div><span>Unassigned</span><strong>{unassignedCount}</strong></div>
      </div>

      <div className="owner-inbox-filters">
        <label><span>Type</span><select value={filters.type} onChange={(event) => updateFilter("type", event.target.value as InboxFilters["type"])}><option value="all">All work</option><option value="inquiry">Inquiries</option><option value="support">Support</option></select></label>
        <label><span>Status</span><select value={filters.status} onChange={(event) => updateFilter("status", event.target.value as InboxFilters["status"])}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Urgency</span><select value={filters.urgency} onChange={(event) => updateFilter("urgency", event.target.value as InboxFilters["urgency"])}><option value="all">All urgency</option><option value="urgent">Urgent</option><option value="standard">Standard</option></select></label>
        <label><span>Due</span><select value={filters.due} onChange={(event) => updateFilter("due", event.target.value as InboxFilters["due"])}><option value="all">Any due state</option><option value="overdue">Overdue</option><option value="due-soon">Due soon</option><option value="scheduled">Scheduled</option><option value="none">No date</option><option value="complete">Complete</option></select></label>
        <button className="button-secondary" type="button" onClick={() => setFilters(emptyFilters)}>Clear</button>
      </div>

      {error ? <p className="owner-inbox-message owner-inbox-error" role="alert">{error}</p> : null}
      {notice ? <p className="owner-inbox-message">{notice}</p> : null}

      <div className="owner-inbox-workspace">
        <div className="owner-inbox-list" aria-label="Owner work queue">
          <div className="owner-inbox-list-heading"><strong>{filteredItems.length} items</strong><span>Newest first</span></div>
          {filteredItems.length ? filteredItems.map((item) => (
            <button
              className={`owner-inbox-row ${itemKey(item) === selectedKey ? "is-selected" : ""}`}
              key={itemKey(item)}
              type="button"
              onClick={() => setSelectedKey(itemKey(item))}
            >
              <span className="owner-inbox-row-top"><span>{item.type}</span><time>{readableDate(item.createdAt)}</time></span>
              <strong>{item.sanitizedSummary}</strong>
              <span className="owner-inbox-row-meta"><span>{item.property.name}</span><span>{item.assignee?.label || "Unassigned"}</span></span>
              <span className="owner-inbox-row-status"><StatusBadge tone={item.urgency === "urgent" ? "danger" : "default"}>{item.urgency}</StatusBadge><StatusBadge>{statusLabels[item.status]}</StatusBadge><StatusBadge tone={dueTone(item.dueState)}>{item.dueState}</StatusBadge></span>
            </button>
          )) : (
            <div className="owner-inbox-empty"><strong>No matching work.</strong><span>Adjust filters or wait for new inquiry and support intake.</span></div>
          )}
        </div>

        <div className="owner-inbox-detail" aria-busy={loading}>
          {loading ? (
            <div className="owner-inbox-detail-state"><strong>Loading private detail...</strong><span>The list remains sanitized while access is checked.</span></div>
          ) : detailResult && form ? (
            <form onSubmit={save}>
              <header className="owner-inbox-detail-header">
                <div><span className="eyebrow">{detailResult.item.type} / {detailResult.item.property.name}</span><h2>{detailResult.item.sanitizedSummary}</h2></div>
                <StatusBadge tone={detailResult.item.urgency === "urgent" ? "danger" : "warning"}>{detailResult.item.urgency}</StatusBadge>
              </header>

              <div className="owner-inbox-private-request">
                <div><span>Requester</span><strong>{detailResult.item.privateRequest.requesterName || "Not supplied"}</strong></div>
                <div><span>Email</span><strong>{detailResult.item.privateRequest.requesterEmail || "Not supplied"}</strong></div>
                <div><span>Rental window</span><strong>{detailResult.item.privateRequest.rentalWindow || "Not supplied"}</strong></div>
                <p>{detailResult.item.privateRequest.message}</p>
              </div>

              <div className="owner-inbox-control-grid">
                <label><span>Status</span><select disabled={!canWrite || saving} value={form.status} onChange={(event) => updateForm("status", event.target.value as OwnerInboxStatus)}>{statusOptions.map((status) => <option key={status} value={status} disabled={["resolved", "closed"].includes(status) && !canClose}>{statusLabels[status]}</option>)}</select></label>
                <label><span>Assignee</span><select disabled={!canWrite || saving} value={form.assigneeMemberId} onChange={(event) => updateForm("assigneeMemberId", event.target.value)}><option value="">Unassigned</option>{detailResult.assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.label} · {assignee.role}</option>)}</select></label>
                <label><span>Due date</span><input disabled={!canWrite || saving} type="datetime-local" value={form.dueAt} onChange={(event) => updateForm("dueAt", event.target.value)} /></label>
                <div className="owner-inbox-due-readout"><span>Due state</span><strong>{detailResult.item.dueState}</strong><small>{readableDate(detailResult.item.dueAt)}</small></div>
              </div>

              <div className="owner-inbox-owner-action"><span>Owner action</span><p>{detailResult.item.ownerAction}</p></div>

              <div className="owner-inbox-draft">
                <div className="owner-inbox-draft-heading"><div><span className="eyebrow">Internal draft only</span><h3>Reply draft</h3></div><label><span>Approval</span><select disabled={!canWrite || saving} value={form.draftApprovalState} onChange={(event) => updateForm("draftApprovalState", event.target.value as OwnerInboxApprovalState)}><option value="none">None</option><option value="draft">Draft</option><option value="pending">Pending review</option>{canApprove ? <><option value="approved">Approved</option><option value="changes-requested">Changes requested</option></> : ["approved", "changes-requested"].includes(form.draftApprovalState) ? <option value={form.draftApprovalState} disabled>{form.draftApprovalState === "approved" ? "Approved" : "Changes requested"}</option> : null}</select></label></div>
                <textarea disabled={!canWrite || saving} maxLength={8000} rows={8} value={form.draftReply} onChange={(event) => updateForm("draftReply", event.target.value)} placeholder="Draft a response for owner review." />
                <p>No send control exists. Approval records an internal decision only.</p>
              </div>

              <footer className="owner-inbox-savebar">
                <div><strong>{actorRole}</strong><span>{canClose ? "Resolve and close capability active" : "Resolve and close require owner capability"}</span></div>
                <button className="button" disabled={!canWrite || saving} type="submit">{saving ? "Recording..." : "Record update"}</button>
              </footer>

              <section className="owner-inbox-timeline">
                <div><span className="eyebrow">Append-only evidence</span><h3>Audit timeline</h3></div>
                {detailResult.item.timeline.length ? <ol>{detailResult.item.timeline.map((event) => <li key={event.id}><span>{event.eventType.replaceAll("-", " ")}</span><strong>{event.actorRole}</strong><time>{readableDate(event.occurredAt)}</time>{event.version ? <small>Version {event.version}</small> : null}</li>)}</ol> : <p>No audit events are available.</p>}
              </section>
            </form>
          ) : selectedItem ? (
            <div className="owner-inbox-detail-state"><strong>Private detail unavailable.</strong><span>Retry by selecting the item again.</span></div>
          ) : (
            <div className="owner-inbox-detail-state"><strong>Select queue work.</strong><span>Private request content appears only after authorized detail access.</span></div>
          )}
        </div>
      </div>

      <footer className="owner-inbox-boundary">
        <strong>External action receipt: 0</strong>
        <span>No email, WhatsApp, vendor dispatch, lease, pricing, availability, or other external commitment is available from this inbox.</span>
      </footer>
    </section>
  );
}
