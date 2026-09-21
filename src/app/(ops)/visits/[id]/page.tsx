"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Panel, SecondaryButton, ErrorBlock, ConfirmDialog, StatusBadge } from "@/components/ui";
import { VisitHeader, CreateCustomerCard, CustomerSnapshot, HistoryLayers, FCSelector } from "@/components/ops";
import type { CustomerSnapshotLive } from "@/lib/api";

/* Active visit workspace (§18, §44): persistent header, FC reassignment,
   completion, and the Stage 3 handoff panel. */

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const router = useRouter();
  const visit = store.getVisit(id);
  const [err, setErr] = useState<{ title: string; body: string } | null>(null);
  const [reassign, setReassign] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const [resolved, setResolved] = useState<CustomerSnapshotLive | null>(null);

  const attachedId = visit?.customerId ?? null;
  const cachedCustomer = attachedId ? store.getCustomer(attachedId) : undefined;
  /* fetchCustomer is a stable useCallback — depending on it (not on the whole
     store object, whose identity changes every render) keeps this effect from
     re-firing in a loop when a record is genuinely missing. */
  const fetchCustomer = store.fetchCustomer;
  const tried = useRef<string | null>(null);

  /* The visit list carries the name but not the record, so a customer attached
     server-side is resolved here rather than reported as "no customer". */
  useEffect(() => {
    if (!attachedId || cachedCustomer) return;
    if (tried.current === attachedId) return; // one attempt per id
    tried.current = attachedId;
    let cancelled = false;
    void (async () => {
      const c = await fetchCustomer(attachedId);
      if (!cancelled) setResolved(c);
    })();
    return () => { cancelled = true; };
  }, [attachedId, cachedCustomer, fetchCustomer]);

  if (!visit) {
    return (
      <Panel className="p-6">
        <h1 className="text-[18px] font-semibold">Visit not found.</h1>
        <p className="mt-1 text-[14px] text-[#78716c]">It may have been completed or ended already.</p>
        <Link href="/today" className="mt-4 inline-block text-[14px] font-semibold text-[#b4234d] hover:underline">← Back to Today</Link>
      </Panel>
    );
  }

  const customer = cachedCustomer ?? resolved ?? undefined;
  const customerLoading = !!attachedId && !customer;
  const fc = store.salespeople.find((s) => s.id === visit.assignedSalespersonId);
  const canReassign = true; // FCs may hand off; server enforces role rules

  const complete = async () => {
    await store.completeVisit(visit.id);
    setConfirmDone(false);
    store.pushToast("Visit completed", "History saved for next time.");
    router.push("/today");
  };

  return (
    <div className="staff-page">
      <VisitHeader visit={visit} customer={customer} fcName={fc?.name} />
      {err && <ErrorBlock title={err.title} body={err.body} actionLabel="Dismiss" onAction={() => setErr(null)} />}

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          {customer ? (
            <Panel className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="staff-h2">Customer</h2>
                <Link href={`/customers/${customer.id}`} className="group inline-flex min-h-[36px] items-center gap-1 text-[13.5px] font-semibold text-[#b4234d] hover:underline">Full history <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">→</span></Link>
              </div>
              <div className="mt-3"><CustomerSnapshot customer={customer} /></div>
            </Panel>
          ) : customerLoading ? (
            <Panel className="p-5 sm:p-6" aria-busy="true" aria-label="Loading customer">
              <div className="skeleton-soft h-5 w-32 rounded-md" />
              <div className="skeleton-soft mt-3 h-16 rounded-xl" />
              <div className="skeleton-soft mt-3 h-12 rounded-xl" style={{ animationDelay: "120ms" }} />
            </Panel>
          ) : attachedId ? (
            /* A record id is attached but the database has no such customer:
               offer to create it instead of a blank panel. */
            <CreateCustomerCard
              title="The attached customer record is missing."
              body="This visit points at a customer that no longer exists. Create the record here, or re-identify the customer on the walk-in screen."
              onCreated={(c) => { setResolved(c); store.pushToast("Customer created", `${c.name} is now attached to this visit.`); }}
            />
          ) : (
            <Panel className="p-5 sm:p-6">
              <h2 className="staff-h2">No customer attached</h2>
              <p className="staff-sub">Identify the customer before continuing — the visit needs one.</p>
              <Link href={`/walk-in?visit=${visit.id}`} className="btn-sheen mt-3 inline-flex min-h-[48px] items-center gap-1 rounded-xl bg-[#1c1917] px-4 text-[14px] font-semibold text-white transition-all duration-150 hover:-translate-y-px active:translate-y-0 active:scale-[0.98]">Go to identification →</Link>
            </Panel>
          )}

          {customer && (
            <Panel className="p-5 sm:p-6">
              <h2 className="staff-h2">Previous visits</h2>
              <p className="staff-sub">Most recent first. Expand for products.</p>
              <div className="mt-3"><HistoryLayers customerId={customer.id} /></div>
            </Panel>
          )}

          {/* Stage 3 handoff (§44) — same visit, next stage */}
          <Panel className="relative overflow-hidden border-[#1c1917] bg-[#1c1917] p-5 text-white sm:p-6">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[#b4234d]/25 blur-3xl" />
            <p className="relative text-[11.5px] font-bold uppercase tracking-[0.12em] text-white/50">Continuation · not a new app</p>
            <h2 className="relative mt-1 text-[19px] font-semibold tracking-tight">Stage 3 — On the floor</h2>
            <p className="relative mt-1 text-[14px] leading-relaxed text-white/70">
              Product selection, trial and verdicts continue on this exact visit.
            </p>
            <div className="relative mt-4 flex min-[420px]:flex-row flex-col gap-2">
              <Link
                href={`/visits/${visit.id}/trial`}
                className="group inline-flex min-h-[52px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-5 text-[15px] font-bold text-[#1c1917] transition-all duration-150 hover:-translate-y-px hover:bg-[#f3eeea] active:translate-y-0 active:scale-[0.98]"
              >
                Continue to Stage 3 <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-1">→</span>
              </Link>
              <button
                onClick={() => setConfirmDone(true)}
                className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-white/25 px-5 text-[14.5px] font-semibold text-white transition-all duration-150 hover:bg-white/10 active:scale-[0.98]"
              >
                Complete visit
              </button>
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold tracking-tight">Assigned FC</h2>
              <StatusBadge value={visit.status} />
            </div>
            <p className="mt-2 text-[15px]">
              {fc ? <><strong className="font-semibold">{fc.name}</strong></> : <span className="font-semibold text-[#9a5b00]">Unassigned — waiting</span>}
            </p>
            {canReassign && (
              <>
                {!reassign ? (
                  <SecondaryButton className="mt-3 w-full" onClick={() => setReassign(true)}>Reassign</SecondaryButton>
                ) : (
                  <div className="ui-fade mt-3">
                    <FCSelector visitId={visit.id} showAuto={false} onDone={() => { setReassign(false); store.pushToast("FC reassigned", "Floor and visit updated together."); }} />
                    <button onClick={() => setReassign(false)} className="mt-2 min-h-[40px] w-full rounded-lg text-center text-[13px] font-semibold text-[#78716c] transition-colors hover:bg-[#f3eeea] hover:text-[#1c1917]">Cancel</button>
                  </div>
                )}
              </>
            )}
          </Panel>

          <Panel className="p-5 sm:p-6">
            <h2 className="text-[15px] font-semibold tracking-tight">Journey so far</h2>
            <ol className="mt-3 flex flex-col">
              {[["Arrived", visit.arrivedAt], ...(visit.assignedAt ? [["FC assigned", visit.assignedAt] as const] : []), ...(visit.startedAt ? [["Started", visit.startedAt] as const] : [])].map(([label, at], i, arr) => (
                <li key={label} className="relative flex gap-2.5 pb-3 last:pb-0">
                  {i < arr.length - 1 && <span aria-hidden className="absolute left-[4px] top-3.5 h-[calc(100%-10px)] w-px bg-[#e8dfd6]" />}
                  <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-[#177245] ring-2 ring-[#e6f4ec]" />
                  <span className="min-w-0"><span className="block text-[13px] font-semibold">{label}</span><span className="tnum block text-[12px] text-[#78716c]">{new Date(at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span></span>
                </li>
              ))}
            </ol>
            <Link href="/floor" className="group mt-3 inline-flex min-h-[36px] items-center gap-1 text-[13.5px] font-semibold text-[#b4234d] hover:underline">See on live floor <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">→</span></Link>
          </Panel>
        </div>
      </div>

      {confirmDone && (
        <ConfirmDialog
          title={`Complete ${customer?.name || "this"} visit?`}
          body="Billing and preferences continue in Stage 4. The visit leaves the active queue but history is kept."
          confirmLabel="Complete visit"
          onCancel={() => setConfirmDone(false)}
          onConfirm={() => void complete()}
        />
      )}
    </div>
  );
}
