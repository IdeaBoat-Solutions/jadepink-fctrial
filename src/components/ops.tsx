"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CustomerSnapshotLive, PastVisitHistoryLive } from "@/lib/api";
import { getCustomerHistory } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";

/* Shared Stage 2 components over the LIVE visit model (VisitLive /
   CustomerSnapshotLive from the Supabase-backed API).
   Kept exports: CustomerSnapshot + HistoryLayers (also used by the parked
   .route-conflicts route), FCQuickAssign, DeleteVisitButton, EndVisitButton. */

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

/* ---------- Inline FC picker: dropdown + tick/cross ----------
   Lives on the live floor so assigning takes seconds. Rendered for every
   signed-in user (FCs and managers alike); the store + API still enforce
   store access and visit-state rules as the final boundary. */

export function FCQuickAssign({ visitId, currentSpId, onAssign }: { visitId: string; currentSpId: string | null; onAssign?: (visitId: string, spId: string) => Promise<void> | void }) {
  const { salespeople, visits, assignSalesperson, pushToast, user } = useStore();
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  // Live load per FC — the same availability rule the assign drawer uses.
  const load = new Map<string, number>();
  for (const v of visits) {
    if (v.assignedSalespersonId && (v.status === "ACTIVE" || v.status === "ASSIGNED")) {
      load.set(v.assignedSalespersonId, (load.get(v.assignedSalespersonId) ?? 0) + 1);
    }
  }
  const assigned = salespeople.find((s) => s.id === currentSpId);

  // Selecting a name assigns straight away — no separate confirm tap.
  const pick = async (spId: string) => {
    if (!spId || saving || spId === currentSpId) return;
    setSaving(true);
    if (onAssign) {
      await onAssign(visitId, spId);
    } else {
      const r = await assignSalesperson(visitId, spId);
      const sp = salespeople.find((s) => s.id === spId);
      if (r.ok) pushToast(sp ? `Assigned to ${sp.name}` : "FC assigned", "Floor updated instantly.");
      else pushToast("Could not assign", r.code === "CUSTOMER_REQUIRED" ? "Attach a customer first." : r.message ?? "Try again.");
    }
    setSaving(false);
  };

  /* Native <select>: the previous Radix dropdown portals its list to
     document.body and applies aria-hidden to the whole page while open. The
     trigger keeps DOM focus inside that hidden ancestor for a frame, which
     Chrome reports as "Blocked aria-hidden ... descendant retained focus".
     A native picker never hides its ancestors, keeps focus valid, and is a
     better touch/screen-reader control for a short FC roster. */
  return (
    <select
      value={currentSpId ?? ""}
      onChange={(e) => void pick(e.target.value)}
      disabled={saving}
      aria-label="Assign FC"
      className="min-h-[44px] w-full rounded-lg border border-[#d6c9bb] bg-white px-3 text-[14px] font-medium text-[#1c1917] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <option value="" disabled={!!currentSpId}>
        {saving ? "Assigning…" : assigned ? `${assigned.name}${user.id === assigned.id ? " (you)" : ""}` : "Pick FC…"}
      </option>
      {salespeople.map((sp) => {
        const n = load.get(sp.id) ?? 0;
        return (
          <option key={sp.id} value={sp.id}>
            {sp.name}{user.id === sp.id ? " (you)" : ""} · {n === 0 ? "Available" : `${n} active`}
          </option>
        );
      })}
    </select>
  );
}

/* ---------- Manager-only inline delete ----------
   Two-step confirm, no drawer. The service refuses live, completed, or
   product-bearing visits — that reason surfaces as a toast. On success, the
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
