"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { friendlyError, isValidMobileIN } from "@/lib/domain";
import type { PastVisitHistoryLive, VisitLive } from "@/lib/api";
import { formatMobileIN } from "@/lib/domain";
import type { CustomerSnapshotLive } from "@/lib/api";
import { getCustomerHistory } from "@/lib/api";
import { timeAgo, clockTime, cn } from "@/lib/utils";
import { PrimaryButton, SecondaryButton, StatusBadge, TextInput } from "@/components/ui";
import { useStore } from "@/lib/store";
import { roundRobinNext } from "@/lib/round-robin";

/* Shared Stage 2 components over the LIVE visit model (VisitLive /
   CustomerSnapshotLive from the Supabase-backed API). */

const STATUS_TEXT: Record<string, string> = {
  ARRIVED: "Arrived",
  IDENTIFYING: "Identifying customer",
  ASSIGNED: "FC assigned",
  ACTIVE: "Active visit",
  COMPLETED: "Completed",
  CANCELLED: "Ended without purchase",
};

export function statusText(s: string): string {
  return STATUS_TEXT[s] ?? s;
}

/* ---------- Persistent visit context header ----------
   Answers: which customer, what status, which FC, how long. Always visible. */

export function VisitHeader({ visit, customer, fcName }: { visit: VisitLive; customer?: CustomerSnapshotLive; fcName?: string }) {
  const contradiction =
    (["ASSIGNED", "ACTIVE"].includes(visit.status) && !visit.assignedSalespersonId)
      ? "This visit shows an assigned state but has no FC. Reassign before continuing."
      : (["ASSIGNED", "ACTIVE"].includes(visit.status) && !visit.customerId)
        ? "This visit shows a customer state but has no customer attached. Identify the customer first."
        : null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#2a2724] bg-[#1c1917] px-5 py-4 text-white shadow-[0_16px_40px_-20px_rgba(28,25,23,0.7)] sm:px-6 sm:py-5">
      <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 size-56 rounded-full bg-[var(--staff-brand)]/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-white/55">
            JadePink Ahmedabad · Arrived {clockTime(visit.arrivedAt)} · {timeAgo(visit.arrivedAt)} ago
          </p>
          <h1 className="mt-1 truncate text-[22px] font-semibold tracking-tight text-balance sm:text-[24px]">
            {customer ? customer.name : "Identifying customer…"}
          </h1>
          <p className="mt-1 text-[13.5px] leading-relaxed text-white/70" aria-live="polite">
            {statusText(visit.status)}{fcName ? <> · <span className="font-semibold text-white">FC: {fcName}</span></> : " · No FC yet"}
            {customer ? <span className="tnum"> · {customer.phone}</span> : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold ring-1 ring-white/15">
            <span aria-hidden className="live-dot inline-block size-1.5 rounded-full bg-emerald-300 text-emerald-300" />
            {statusText(visit.status)}
          </span>
          {customer && (
            <Link href={`/customers/${customer.id}`} className="group inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-white/10 px-3.5 text-[13.5px] font-semibold text-white ring-1 ring-white/15 transition-all duration-150 hover:-translate-y-px hover:bg-white/20 active:translate-y-0">
              History <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
            </Link>
          )}
        </div>
      </div>
      {contradiction && (
        <p role="alert" className="relative mt-3 rounded-xl bg-[#fdf1d7] px-3.5 py-2.5 text-[13px] font-medium leading-relaxed text-[#7a4a00]">{contradiction}</p>
      )}
    </div>
  );
}

/* ---------- Compact customer snapshot (supporting info, not the task) ---------- */

export function CustomerSnapshot({ customer, compact }: { customer: CustomerSnapshotLive; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[18px] font-semibold tracking-tight text-[#1c1917]">{customer.name}</p>
          <p className="tnum text-[14px] text-[#57534e]">{customer.phone}</p>
          {(customer.area || customer.budget || customer.source) && (
            <p className="mt-1 text-[12.5px] text-[#78716c]">
              {[customer.area, customer.budget, customer.source ? `via ${customer.source}` : null].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#177245]">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#177245]" />
            {customer.visitCount > 0 ? "Returning customer" : "First visit"}
          </p>
        </div>
        {!compact && (
          <Link href={`/customers/${customer.id}`} className="shrink-0 text-[13.5px] font-semibold text-[var(--staff-brand)] underline-offset-2 hover:underline">
            View history
          </Link>
        )}
      </div>
      {(customer.area || customer.budget || customer.source) && (
        <p className="text-[12.5px] text-[#78716c]">
          {[customer.area, customer.budget, customer.source ? `via ${customer.source}` : null].filter(Boolean).join(" · ")}
        </p>
      )}
      <dl className="grid grid-cols-3 gap-2 border-t border-[#e8dfd6] pt-3">
        <div><dt className="text-[12px] font-medium text-[#78716c]">Visits</dt><dd className="tnum text-[16px] font-semibold">{customer.visitCount}</dd></div>
        <div><dt className="text-[12px] font-medium text-[#78716c]">Purchases</dt><dd className="tnum text-[16px] font-semibold">{customer.purchaseCount}</dd></div>
        <div>
          <dt className="text-[12px] font-medium text-[#78716c]">Last visit</dt>
          <dd className="text-[13.5px] font-semibold">
            {customer.lastVisitAt ? new Date(customer.lastVisitAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "First one"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ---------- Progressive history: L1 snapshot → L2 visits → L3 items ----------
   §35: history is limited — 3 recent visits shown, "Older visits" discloses
   the rest instead of rendering every record at once. */

const HISTORY_PAGE = 3;

export function HistoryLayers({ customerId }: { customerId: string }) {
  const [history, setHistory] = useState<PastVisitHistoryLive[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(HISTORY_PAGE);
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await getCustomerHistory(customerId);
      if (cancelled) return;
      if (!r.ok) {
        setHistory([]);
        setLoadErr(r.message || "Could not load history.");
        return;
      }
      setHistory(r.data);
      setOpen(r.data[0]?.id ?? null);
      setLoadErr("");
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  if (history === null) {
    return <p className="px-1 py-3 text-[13.5px] text-[#78716c]" aria-busy="true">Loading history…</p>;
  }
  const visible = history.slice(0, limit);
  return (
    <div className="flex flex-col gap-2">
      {loadErr && <p role="alert" className="px-1 text-[13px] font-medium text-[#b4232a]">{loadErr}</p>}
      {history.length === 0 && !loadErr && (
        <p className="px-1 py-3 text-[13.5px] text-[#78716c]">
          No trial history recorded for this customer yet.
        </p>
      )}
      {visible.map((h) => {
        const expanded = open === h.id;
        return (
          <div key={h.id} className="rounded-lg border border-[#e8dfd6]">
            <button
              onClick={() => setOpen(expanded ? null : h.id)}
              aria-expanded={expanded}
              className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left hover:bg-[#faf8f6]"
            >
              <span>
                <span className="block text-[14px] font-semibold text-[#1c1917]">{h.dateLabel} <span className="font-normal text-[#78716c]">· FC: {h.fcName}</span></span>
                <span className="tnum block text-[12.5px] text-[#57534e]">Trialled {h.trialled} · Liked {h.liked} · Purchased {h.purchased}</span>
              </span>
              <span aria-hidden className={cn("text-[#78716c] transition-transform", expanded && "rotate-180")}>▾</span>
            </button>
            {expanded && (
              <div className="ui-fade border-t border-[#e8dfd6] bg-[#faf8f6] px-4 py-3">
                {h.items.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {h.items.map((it, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 text-[13.5px]">
                        <span>{it.name} <span className="text-[#78716c]">· {it.size}{it.colour ? ` · ${it.colour}` : ""}</span></span>
                        <StatusBadge value={it.verdict === "rejected" ? "offline" : it.verdict === "purchased" ? "ACTIVE" : "IDENTIFYING"} label={it.verdict} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13.5px] text-[#78716c]">Visit recorded — no products were scanned on the floor.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
      {history.length > visible.length && (
        <button
          onClick={() => setLimit((l) => l + HISTORY_PAGE)}
          className="min-h-[44px] rounded-lg border border-dashed border-[#d6c9bb] text-[13.5px] font-semibold text-[#78716c] hover:border-[#1c1917] hover:text-[#1c1917]"
        >
          Older visits ({history.length - visible.length} more)
        </button>
      )}
    </div>
  );
}

/* ---------- FC selector: availability obvious, touch targets large ---------- */

export function FCSelector({ visitId, currentSpId, onDone, showAuto = true }: { visitId: string; currentSpId?: string | null; onDone?: (spId: string) => void; showAuto?: boolean }) {
  const { salespeople, visits, assignSalesperson, pushToast, user } = useStore();
  const [saving, setSaving] = useState<string | null>(null);

  const load = new Map<string, number>();
  visits.forEach((v) => {
    if (v.assignedSalespersonId && ["ASSIGNED", "ACTIVE"].includes(v.status)) load.set(v.assignedSalespersonId, (load.get(v.assignedSalespersonId) || 0) + 1);
  });

  const pick = async (sp: { id: string; name: string }) => {
    setSaving(sp.id);
    // §7: instant optimistic acknowledgement, then commit + rollback on failure.
    const r = await assignSalesperson(visitId, sp.id);
    setSaving(null);
    if (r.ok) {
      pushToast(`Assigned to ${sp.name}`, "The team floor updated instantly.");
      onDone?.(sp.id);
    } else {
      pushToast("Could not assign", r.code === "CUSTOMER_REQUIRED" ? "Attach a customer first." : r.message ?? "Try again.");
    }
  };

  const me = user ? salespeople.find((sp) => sp.id === user.id) : undefined;
  const meAssigned = me && currentSpId === me.id;
  /* Role rule (src/lib/policy.ts): an FC may only take a customer themselves —
     assigning anyone else needs a manager. Managers see the whole team. */
  const selfOnly = user?.role === "fc";
  const roster = selfOnly ? salespeople.filter((sp) => sp.id === user?.id) : salespeople;

  return (
    <div className="flex flex-col gap-2">
      {/* One-tap self-assignment: the logged-in FC serves this customer directly. */}
      {me && !meAssigned && (
        <button
          onClick={() => void pick(me)}
          disabled={saving !== null}
          className="btn-sheen inline-flex min-h-[52px] items-center justify-center gap-1.5 rounded-xl bg-[#1c1917] px-4 text-[14.5px] font-bold text-white transition-all duration-150 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:opacity-60"
        >
          {saving === me.id ? "Assigning you…" : `Take this customer — assign to me (${me.name}) →`}
        </button>
      )}
      {meAssigned && (
        <p className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#bfe3cd] bg-[#f2faf5] px-3.5 text-[14px] font-semibold text-[#177245]">
          <span aria-hidden className="grid size-5 place-items-center rounded-full bg-[#177245] text-[12px] text-white">✓</span>
          Assigned to you
        </p>
      )}
      {selfOnly && !me && salespeople.length > 0 && (
        <p className="rounded-xl bg-[#faf8f6] px-4 py-3 text-[13.5px] leading-relaxed text-[#78716c]">
          Your staff profile isn&apos;t in the FC list — ask a manager to assign this customer.
        </p>
      )}
      {salespeople.length === 0 && (
        <p className="rounded-xl bg-[#faf8f6] px-4 py-3 text-[13.5px] leading-relaxed text-[#78716c]">
          No active FCs found for this store. Ask a manager to activate staff profiles, then try again.
        </p>
      )}
      <div role="radiogroup" aria-label="Assign FC" className="flex flex-col gap-2">
        {roster.map((sp) => {
          const n = load.get(sp.id) || 0;
          const selected = currentSpId === sp.id;
          const isMe = user?.id === sp.id;
          return (
            <button
              key={sp.id} role="radio" aria-checked={selected} disabled={saving !== null}
              onClick={() => void pick(sp)}
              className={cn(
                "flex min-h-[60px] items-center justify-between gap-3 rounded-lg border px-4 text-left transition-colors",
                selected
                  ? "border-[#177245] bg-[#f2faf5]"
                  : "border-[#d6c9bb] bg-white hover:border-[#1c1917]"
              )}
            >
              <span className="flex items-center gap-3">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3eeea] text-[14px] font-bold text-[#57534e]">
                  {sp.name.charAt(0)}
                </span>
                <span>
                  <span className="block text-[15px] font-semibold text-[#1c1917]">
                    {sp.name} {isMe && <span className="text-[12px] font-medium text-[#78716c]">(you)</span>}
                    {selected && <span className="ml-1.5 rounded-full bg-[#177245] px-2 py-0.5 text-[11px] font-bold text-white">Assigned</span>}
                  </span>
                  <span className="text-[12.5px] text-[#78716c]">
                    {n ? `${n} active visit${n > 1 ? "s" : ""}` : "Free now"}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {saving === sp.id && <span className="text-[12.5px] font-medium text-[#78716c]">Assigning…</span>}
                {!saving && !selected && n === 0 && <StatusBadge value="available" />}
                {!saving && !selected && n > 0 && <StatusBadge value="busy" />}
              </span>
            </button>
          );
        })}
      </div>
      {showAuto && !selfOnly && salespeople.length > 0 && (
        <SecondaryButton onClick={() => {
          // Round robin: next in roster rotation; falls back to fewest load with no history.
          const candidate = roundRobinNext(salespeople, visits);
          if (candidate) void pick(candidate);
        }} disabled={saving !== null}>
          {saving !== null ? "Assigning…" : "Auto-assign — round robin (next up)"}
        </SecondaryButton>
      )}
    </div>
  );
}

/* ---------- Inline FC picker: dropdown + tick/cross ----------
   Lives on the live floor so assigning takes seconds. Rendered for every
   signed-in user (FCs and managers alike); the store + API still enforce
   store access and visit-state rules as the final boundary. */

export function FCQuickAssign({ visitId, currentSpId, onAssign }: { visitId: string; currentSpId: string | null; onAssign?: (visitId: string, spId: string) => Promise<void> | void }) {
  const { salespeople, assignSalesperson, pushToast, user } = useStore();
  const [sel, setSel] = useState(currentSpId ?? "");
  const [saving, setSaving] = useState(false);
  const [prevSpId, setPrevSpId] = useState(currentSpId);

  // Follow external changes (reassigned from another screen meanwhile).
  // Render-phase adjustment — the documented pattern for syncing state to props.
  if (prevSpId !== currentSpId) {
    setPrevSpId(currentSpId);
    setSel(currentSpId ?? "");
  }

  if (!user) return null;

  const dirty = sel !== (currentSpId ?? "");
  const confirm = async () => {
    if (!sel || saving) return;
    setSaving(true);
    if (onAssign) {
      await onAssign(visitId, sel);
    } else {
      const r = await assignSalesperson(visitId, sel);
      if (r.ok) {
        const sp = salespeople.find((s) => s.id === sel);
        pushToast(sp ? `Assigned to ${sp.name}` : "FC assigned", "Floor updated instantly.");
      } else {
        pushToast("Could not assign", r.code === "CUSTOMER_REQUIRED" ? "Attach a customer first." : r.message ?? "Try again.");
        setSel(currentSpId ?? "");
      }
    }
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={sel}
        onChange={(e) => setSel(e.target.value)}
        disabled={saving}
        aria-label="Assign FC"
        className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-[#d6c9bb] bg-white px-2.5 text-[14px] font-medium text-[#1c1917]"
      >
        <option value="">Pick FC…</option>
        {salespeople.map((sp) => (
          <option key={sp.id} value={sp.id}>
            {sp.name}{user?.id === sp.id ? " (you)" : ""}
          </option>
        ))}
      </select>
      <button
        onClick={confirm}
        disabled={!sel || !dirty || saving}
        aria-label="Confirm FC assignment"
        title="Confirm"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-[#177245] text-[16px] font-bold text-white disabled:opacity-30"
      >
        ✓
      </button>
      <button
        onClick={() => setSel(currentSpId ?? "")}
        disabled={!dirty || saving}
        aria-label="Cancel FC change"
        title="Cancel"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[#d6c9bb] text-[15px] font-bold text-[#78716c] disabled:opacity-30"
      >
        ✕
      </button>
    </div>
  );
}

/* ---------- Manager-only inline delete ----------
   Two-step confirm, no drawer. The service refuses live, completed, or
   product-bearing visits — that reason surfaces as a toast. On success the
   store drops the visit and the row unmounts. */
export function DeleteVisitButton({ visitId, name }: { visitId: string; name: string }) {
  const { deleteVisit, pushToast } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    const r = await deleteVisit(visitId);
    setDeleting(false);
    if (!r.ok) {
      setConfirming(false);
      pushToast("Could not delete visit", r.message || "This visit can't be deleted.");
    }
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${name}'s visit`}
        className="inline-flex min-h-11 items-center rounded-lg border border-[#e4c4be] bg-[var(--fp-drop-bg)] px-3 text-[13px] font-semibold text-[var(--fp-drop)] hover:border-[var(--fp-drop)]"
      >
        Delete
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <button onClick={() => void remove()} disabled={deleting} className="inline-flex min-h-11 items-center rounded-lg bg-[var(--fp-drop)] px-3 text-[13px] font-semibold text-white disabled:opacity-50">
        {deleting ? "Deleting…" : "Confirm"}
      </button>
      <button onClick={() => setConfirming(false)} disabled={deleting} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--fp-line-strong)] px-3 text-[13px] font-semibold text-[var(--fp-muted)]">
        Keep
      </button>
    </span>
  );
}

/* ---------- End visit (FC-side cancel) ----------
   Two-step confirm. Any signed-in user on the visit's store may end it — the
   service refuses only when liked/trialled pieces are still unbilled (bill or
   drop them first). On success the store drops the visit and the row unmounts.
   Unlike Delete this keeps the record (CANCELLED) so history stays intact. */
export function EndVisitButton({ visitId, name, className }: { visitId: string; name: string; className?: string }) {
  const { abandonVisit } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);

  const end = async () => {
    if (ending) return;
    setEnding(true);
    await abandonVisit(visitId);
    // Success → store removes the visit (unmount). Failure → toast fired inside
    // the store; keep the confirm open so the reason stays visible.
    setEnding(false);
    setConfirming(false);
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        aria-label={`End ${name}'s visit`}
        className={cn(
          "inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--fp-line-strong)] bg-[var(--fp-surface)] px-4 text-[14px] font-semibold text-[var(--fp-muted)] hover:border-[var(--fp-ink)] hover:text-[var(--fp-ink)]",
          className,
        )}
      >
        End visit
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <button onClick={() => void end()} disabled={ending} className="inline-flex min-h-11 items-center rounded-xl bg-[var(--fp-drop)] px-3.5 text-[13.5px] font-semibold text-white disabled:opacity-50">
        {ending ? "Ending…" : "End without sale"}
      </button>
      <button onClick={() => setConfirming(false)} disabled={ending} className="inline-flex min-h-11 items-center rounded-xl border border-[var(--fp-line-strong)] px-3.5 text-[13.5px] font-semibold text-[var(--fp-muted)]">
        Keep
      </button>
    </span>
  );
}

/* ---------- Visit timeline (human labels, never raw event names) ----------
   Stage 2 + Stage 3 in one journey: walk-in → identify → FC → products →
   trial → liked/dropped. Detail (SKU, drop reason) comes from event metadata. */

const EVENT_LABEL: Record<string, string> = {
  WALK_IN_RECORDED: "Walk-in recorded",
  CUSTOMER_IDENTIFIED: "Customer identified",
  CUSTOMER_ATTACHED: "Customer identified",
  NEW_CUSTOMER_CREATED: "New customer created",
  FC_ASSIGNED: "FC assigned",
  FC_REASSIGNED: "FC reassigned",
  VISIT_STARTED: "Visit started",
  VISIT_COMPLETED: "Visit completed",
  VISIT_CANCELLED: "Visit ended without purchase",
  VISIT_ABANDONED: "Visit ended without purchase",
  PRODUCT_ADDED: "Product added",
  PRODUCT_REMOVED: "Product removed",
  TRIAL_STARTED: "Trial started",
  TRIAL_COMPLETED: "Trial completed",
  TRIAL_REOPENED: "Trial reopened",
  TRIAL_CANCELLED: "Trial cancelled",
  PRODUCT_LIKED: "Product liked",
  PRODUCT_UNLIKED: "Like removed",
  PRODUCT_DROPPED: "Product dropped",
  PRODUCT_UNDROPPED: "Drop undone — back on visit",
  DROP_REASON_CAPTURED: "Drop reason updated",
  PRODUCT_PURCHASED: "Product purchased",
};

export interface VisitTimelineEvent {
  id: string;
  type: string;
  at: string;
  actorName?: string;
  detail?: string | null;
}

function eventDetail(type: string, metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  const sku = typeof metadata.sku === "string" ? metadata.sku : null;
  const code = typeof metadata.drop_reason_code === "string" ? metadata.drop_reason_code : null;
  const label = typeof metadata.drop_reason_label === "string" ? metadata.drop_reason_label : null;
  if (type === "PRODUCT_DROPPED" || type === "DROP_REASON_CAPTURED") {
    const reason = label ?? (code ? code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, " ") : null);
    return [sku, reason ? `Reason: ${reason}` : null].filter(Boolean).join(" · ") || null;
  }
  return sku;
}

export function VisitTimeline({ events }: { events: VisitTimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-[13.5px] text-[#78716c]">No journey events yet.</p>;
  }
  return (
    <ol className="flex flex-col">
      {events.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < events.length - 1 && <span aria-hidden className="absolute left-[5px] top-4 h-[calc(100%-12px)] w-px bg-[#e8dfd6]" />}
          <span aria-hidden className="mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-[var(--staff-brand)] bg-white" />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-[#1c1917]">
              {EVENT_LABEL[e.type] || e.type}
              {e.actorName && <span className="font-normal text-[#78716c]"> · {e.actorName}</span>}
            </p>
            {e.detail && <p className="mt-0.5 truncate text-[12.5px] text-[#78716c]">{e.detail}</p>}
            <p className="tnum text-[12px] text-[var(--fp-muted)]">{new Date(e.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Visit timeline panel (fetches the full journey) ----------
   One GET to /api/visits/[id]/timeline. Used on visit detail + trial pages
   so Stage 3 product events are visible, not just DB rows. */

export function VisitTimelinePanel({ visitId }: { visitId: string }) {
  const [events, setEvents] = React.useState<VisitTimelineEvent[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/visits/${visitId}/timeline`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(json.message ?? "timeline"));
        if (!cancelled) setEvents((json.data ?? []) as VisitTimelineEvent[]);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [visitId]);

  if (failed) return <p className="text-[13px] text-[#78716c]">Journey history is unavailable right now.</p>;
  if (!events) {
    return (
      <div aria-busy="true" aria-label="Loading journey" className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-soft h-9 rounded-lg" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    );
  }
  return <VisitTimeline events={events} />;
}

export { eventDetail };

/* ---------- Active visit row (dashboard + floor share one pattern) ---------- */

export function ActiveVisitRow({ visit }: { visit: VisitLive }) {
  const { getCustomer, salespeople } = useStore();
  const c = visit.customerId ? getCustomer(visit.customerId) : undefined;
  const fc = salespeople.find((s) => s.id === visit.assignedSalespersonId);
  const label = visit.status === "ACTIVE" ? "On the floor" : visit.assignedSalespersonId ? "Assigned" : "Waiting";
  return (
    <Link
      href={`/visits/${visit.id}`}
      className="pressable group flex min-h-[72px] items-center justify-between gap-3 rounded-2xl border border-[#e8dfd6] bg-white px-4 py-3"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f3eeea] text-[15px] font-bold text-[#57534e] transition-colors duration-150 group-hover:bg-[#1c1917] group-hover:text-white">
          {(c?.name || "U").charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold tracking-tight text-[#1c1917]">{c?.name || "Unnamed customer"}</span>
          <span className="tnum mt-0.5 block truncate text-[13px] text-[#78716c]">
            {statusText(visit.status)} · {timeAgo(visit.arrivedAt)} in store
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="hidden rounded-full bg-[#faf8f6] px-2.5 py-1 text-[12.5px] font-medium text-[#57534e] ring-1 ring-[#e8dfd6] sm:block">{fc ? `FC: ${fc.name}` : "Unassigned"}</span>
        <StatusBadge value={visit.status} label={visit.assignedSalespersonId ? label : "Waiting"} />
        <span aria-hidden className="text-[14px] font-bold text-[#d6c9bb] transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[#1c1917]">→</span>
      </span>
    </Link>
  );
}

/* ---------- Create customer (the "no record" path) ----------
   One canonical panel for every surface that discovers a missing record: the
   directory, a customer URL that no longer resolves, and a walk-in. Creating
   the record is always offered, prefilled with whatever the operator typed. */

const CUSTOMER_SOURCES = ["Walk-in", "Instagram", "Meta Lead", "Referral", "Google", "Other"] as const;

export function CreateCustomerCard({
  prefillName = "",
  prefillMobile = "",
  defaultSource = "Walk-in",
  title = "No record for this customer yet.",
  body = "Create it now — takes 10 seconds and the visit or profile picks it up immediately.",
  onCreated,
  onCancel,
  autoFocus,
  compact = false,
}: {
  prefillName?: string;
  prefillMobile?: string;
  defaultSource?: string;
  title?: string;
  body?: React.ReactNode;
  onCreated: (customer: CustomerSnapshotLive) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  /** One-line miss row: [Name][Mobile][Source ▾][Create] — source captured at creation. */
  compact?: boolean;
}) {
  const { createCustomer, searchCustomer, pushToast } = useStore();
  const [name, setName] = useState(prefillName);
  const [mobile, setMobile] = useState(prefillMobile);
  const [source, setSource] = useState(defaultSource);
  const [area, setArea] = useState("");
  const [budget, setBudget] = useState("₹5–15k");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [existing, setExisting] = useState<CustomerSnapshotLive | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  /* Prefills follow the search box live, but never overwrite a field the
     operator has already typed into. */
  const touched = useRef({ name: false, mobile: false });

  useEffect(() => {
    if (!touched.current.name && prefillName !== name) setName(prefillName);
    if (!touched.current.mobile && prefillMobile !== mobile) setMobile(prefillMobile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillName, prefillMobile]);

  useEffect(() => {
    if (!autoFocus) return;
    // Focus whichever field still needs input.
    (isValidMobileIN(prefillMobile) ? nameRef : mobileRef).current?.focus();
  }, [autoFocus, prefillMobile]);

  const submit = async () => {
    setErr("");
    setExisting(null);
    const cleanName = name.trim();
    if (cleanName.length < 2) { setErr("Enter the customer's name."); nameRef.current?.focus(); return; }
    if (!isValidMobileIN(mobile)) { setErr("Enter a valid 10-digit Indian mobile number."); mobileRef.current?.focus(); return; }
    setBusy(true);
    const r = await createCustomer({ name: cleanName, mobile, source, area: area.trim() || undefined, budget: budget || undefined });
    setBusy(false);
    if (r.ok) {
      pushToast("Customer created", `${r.customer.name} · ${formatMobileIN(r.customer.phone)}`);
      onCreated(r.customer);
      return;
    }
    // A duplicate is not a failure — resolve the existing record and offer it.
    if (r.code === "CUSTOMER_ALREADY_EXISTS") {
      const found = await searchCustomer(mobile);
      if (found) { setExisting(found); return; }
      setErr("That number is already registered. Search it to open the existing record.");
      return;
    }
    setErr(r.message || friendlyError(r.code).body);
  };

  return (
    <>
      {compact && (
        <section className="ui-fade rounded-2xl border border-dashed border-[#d6c9bb] bg-[#faf8f6]/70 px-3 py-2.5" aria-label={title}>
          <form
            className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center"
            onSubmit={(e) => { e.preventDefault(); void submit(); }}
            aria-label="Create customer record"
          >
            <p className="flex min-w-0 items-center gap-2 text-[13.5px] lg:max-w-[240px] lg:shrink-0">
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#fdf0f4] text-[15px] font-bold text-[var(--staff-brand)] ring-1 ring-[var(--staff-brand)]/20">+</span>
              <span className="truncate font-semibold tracking-tight" title={title}>{title}</span>
            </p>
            <label htmlFor="cc-name" className="sr-only">Name</label>
            <TextInput
              id="cc-name"
              ref={nameRef}
              value={name}
              onChange={(e) => { touched.current.name = true; setName(e.target.value); setErr(""); setExisting(null); }}
              placeholder="Name"
              autoComplete="off"
              aria-invalid={!!err && name.trim().length < 2}
              className="lg:max-w-[200px]"
            />
            <label htmlFor="cc-mobile" className="sr-only">Mobile</label>
            <TextInput
              id="cc-mobile"
              ref={mobileRef}
              value={mobile}
              onChange={(e) => { touched.current.mobile = true; setMobile(e.target.value); setErr(""); setExisting(null); }}
              placeholder="Mobile"
              inputMode="tel"
              autoComplete="off"
              className="tnum lg:max-w-[170px]"
              aria-invalid={!!err && !isValidMobileIN(mobile)}
            />
            <span className="flex flex-col gap-1 lg:w-auto lg:flex-row lg:items-center lg:gap-2 lg:shrink-0">
              <label htmlFor="cc-source" className="shrink-0 text-[13px] font-medium whitespace-nowrap text-[#78716c]">
                How did they hear about us?
              </label>
              <select
                id="cc-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border border-[#d6c9bb] bg-white px-3.5 text-[15px] text-[#1c1917] transition-colors hover:border-[#a8a29e] focus:border-[var(--staff-brand)] focus:outline-none focus:ring-4 focus:ring-[var(--staff-brand)]/15 lg:w-[190px] lg:shrink-0"
              >
                {CUSTOMER_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <label htmlFor="cc-area" className="sr-only">Area</label>
              <TextInput
                id="cc-area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Area"
                autoComplete="off"
                className="lg:max-w-[150px]"
              />
              <label htmlFor="cc-budget" className="sr-only">Budget</label>
              <select
                id="cc-budget"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                title="Budget"
                className="min-h-[48px] w-full rounded-xl border border-[#d6c9bb] bg-white px-3.5 text-[15px] text-[#1c1917] lg:w-[140px] lg:shrink-0"
              >
                {["Under ₹5k", "₹5–15k", "₹15–30k", "₹30k+"].map((b) => <option key={b}>{b}</option>)}
              </select>
            </span>
            <span className="flex gap-2 lg:ml-auto lg:shrink-0">
              <PrimaryButton type="submit" disabled={busy} className="min-h-[44px] flex-1 px-5 lg:flex-none">
                {busy ? "Creating…" : "Create →"}
              </PrimaryButton>
              {onCancel && (
                <SecondaryButton type="button" onClick={onCancel} disabled={busy} aria-label="Cancel new customer" className="min-h-[44px] px-4">✕</SecondaryButton>
              )}
            </span>
          </form>
          {existing ? (
            <div className="mt-2 flex flex-col gap-2 rounded-xl border border-[#f0d48a] bg-[#fffdf5] p-2.5 lg:flex-row lg:items-center">
              <p className="text-[13px] font-semibold text-[#9a5b00]">That number exists —</p>
              <div className="min-w-0 flex-1"><CustomerSnapshot customer={existing} compact /></div>
              <PrimaryButton onClick={() => onCreated(existing)} className="min-h-[44px] lg:w-auto">Use it →</PrimaryButton>
            </div>
          ) : err ? (
            <p role="alert" className="mt-1.5 text-[13px] font-medium text-[#b4232a]">{err}</p>
          ) : null}
        </section>
      )}
      {!compact && (
    <section className="ui-fade rounded-2xl border border-[var(--staff-brand)]/35 bg-[#fdf0f4]/50 px-3 py-2.5" aria-label={title}>
      {existing ? (
        <div className="ui-fade rounded-xl border border-[#f0d48a] bg-[#fffdf5] p-3">
          <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-[#9a5b00]">
            <span aria-hidden className="grid size-5 place-items-center rounded-full bg-[#fdf1d7] text-[12px] ring-1 ring-[#f0d48a]">!</span>
            That number is already registered.
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#78716c]">Use the existing record instead — history stays in one place.</p>
          <div className="mt-2 rounded-xl border border-[#e8dfd6] bg-white p-3">
            <CustomerSnapshot customer={existing} compact />
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <PrimaryButton onClick={() => onCreated(existing)} className="min-h-[44px] flex-1">Use existing record →</PrimaryButton>
            <Link href={`/customers/${existing.id}`} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#d6c9bb] px-4 text-[13.5px] font-semibold transition-all duration-150 hover:-translate-y-px hover:border-[#1c1917] hover:bg-white active:translate-y-0">
              Open profile
            </Link>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2 xl:flex-row xl:items-center"
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
          aria-label="Create customer record"
        >
          <p className="flex min-w-0 items-center gap-2 text-[13.5px] xl:max-w-[220px] xl:shrink-0">
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#fdf0f4] text-[15px] font-bold text-[var(--staff-brand)] ring-1 ring-[var(--staff-brand)]/20">+</span>
            <span className="min-w-0">
              <span className="block truncate font-semibold tracking-tight" title={title}>{title}</span>
              {typeof body === "string" ? (
                <span className="block truncate text-[12px] font-normal text-[#78716c]" title={body}>{body}</span>
              ) : null}
            </span>
          </p>
          <label htmlFor="cc-name" className="sr-only">Name (required)</label>
          <TextInput
            id="cc-name"
            ref={nameRef}
            value={name}
            onChange={(e) => { touched.current.name = true; setName(e.target.value); setErr(""); }}
            placeholder="Name *"
            autoComplete="off"
            aria-invalid={!!err && name.trim().length < 2}
            className="xl:max-w-[180px]"
          />
          <label htmlFor="cc-mobile" className="sr-only">Mobile (required)</label>
          <TextInput
            id="cc-mobile"
            ref={mobileRef}
            value={mobile}
            onChange={(e) => { touched.current.mobile = true; setMobile(e.target.value); setErr(""); }}
            placeholder="Mobile *"
            inputMode="tel"
            autoComplete="off"
            className="tnum xl:max-w-[150px]"
            aria-invalid={!!err && !isValidMobileIN(mobile)}
          />
          <label htmlFor="cc-source" className="sr-only">How did you hear about us?</label>
          <select
            id="cc-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            title="How did you hear about us?"
            className="min-h-[44px] w-full rounded-xl border border-[#d6c9bb] bg-white px-3 text-[14px] shadow-[inset_0_1px_2px_rgba(28,25,23,0.04)] transition-all duration-150 hover:border-[#a8a29e] focus:border-[var(--staff-brand)] focus:outline-none focus:ring-4 focus:ring-[var(--staff-brand)]/15 xl:max-w-[150px]"
          >
            {CUSTOMER_SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <label htmlFor="cc-area2" className="sr-only">Area</label>
          <TextInput
            id="cc-area2"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Area"
            autoComplete="off"
            className="xl:max-w-[130px]"
          />
          <label htmlFor="cc-budget2" className="sr-only">Budget</label>
          <select
            id="cc-budget2"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            title="Budget"
            className="min-h-[44px] w-full rounded-xl border border-[#d6c9bb] bg-white px-3 text-[14px] xl:max-w-[130px]"
          >
            {["Under ₹5k", "₹5–15k", "₹15–30k", "₹30k+"].map((b) => <option key={b}>{b}</option>)}
          </select>
          <span className="flex gap-2 xl:ml-auto xl:shrink-0">
            <PrimaryButton type="submit" disabled={busy} className="min-h-[44px] flex-1 px-5 xl:flex-none">
              {busy ? "Creating…" : "Create →"}
            </PrimaryButton>
            {onCancel && (
              <SecondaryButton type="button" onClick={onCancel} disabled={busy} className="min-h-[44px] px-4">✕</SecondaryButton>
            )}
          </span>
        </form>
      )}
      {!existing && (err ? (
        <p role="alert" className="mt-1.5 text-[13px] font-medium text-[#b4232a]">{err}</p>
      ) : null)}
    </section>
      )}
    </>
  );
}

/* ---------- Walk-in stepper ---------- */

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol aria-label="Walk-in progress" className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {steps.map((s, i) => {
        const done = i < current, active = i === current;
        return (
          <li key={s} className="flex items-center gap-1.5">
            <span className={cn(
              "flex min-h-[30px] items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold transition-all duration-200",
              done ? "bg-[#e6f4ec] text-[#177245] ring-1 ring-[#bfe3cd]" : active ? "bg-[#1c1917] text-white shadow-[0_4px_12px_-4px_rgba(28,25,23,0.5)]" : "bg-[#f3eeea] text-[#78716c]"
            )}>
              <span aria-hidden className={cn("grid size-4 place-items-center rounded-full text-[10px] font-bold", done ? "bg-[#177245] text-white" : active ? "bg-white/20 text-white" : "bg-[#e8dfd6] text-[#78716c]")}>{done ? "✓" : `${i + 1}`}</span> {s}
            </span>
            {i < steps.length - 1 && <span aria-hidden className={cn("h-px w-3 transition-colors", i < current ? "bg-[#177245]" : "bg-[#d6c9bb]")} />}
          </li>
        );
      })}
    </ol>
  );
}
