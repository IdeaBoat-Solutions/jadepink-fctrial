"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { timeAgo } from "@/lib/utils";
import { Panel, EmptyState, StatusBadge } from "@/components/ui";
import { FCQuickAssign } from "@/components/ops";
import { paginate } from "@/lib/pagination";
import { PaginationControls, usePageParam } from "@/components/pagination";

const FLOOR_PAGE_SIZE = 9;

/* Live floor (§19): store-manager view of every active visit. "Live" means
   refreshed data on a calm interval, never flashing UI. */

function FloorInner() {
  const { visits, customers, getCustomer, salespeople, assignSalesperson, pushToast } = useStore();
  const [, setNow] = useState(0);
  const { page, setPage } = usePageParam();

  // Calm refresh of relative times
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const live = visits.filter((v) => ["ACTIVE", "ASSIGNED", "IDENTIFYING", "ARRIVED"].includes(v.status));
  const unassigned = live.filter((v) => !v.assignedSalespersonId && v.customerId);
  const identifying = live.filter((v) => !v.customerId);
  const paged = paginate(live, page, FLOOR_PAGE_SIZE);

  const fcLoad = (spId: string) => live.filter((v) => v.assignedSalespersonId === spId).length;

  const quickAssign = async (visitId: string, spId: string) => {
    const r = await assignSalesperson(visitId, spId);
    if (!r.ok) pushToast("Could not assign", r.message ?? "Try again once.");
    else pushToast("FC assigned", "Floor updated.");
  };

  const spName = (id: string | null) => (id ? salespeople.find((s) => s.id === id)?.name ?? "Team" : null);

  return (
    <div className="staff-page">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="staff-kicker">Store manager view</p>
          <h1 className="staff-title mt-1 flex flex-wrap items-center gap-2.5">Live floor
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bfe3cd] bg-[#e6f4ec] px-2.5 py-1 text-[11.5px] font-bold tracking-wide text-[#177245]">
              <span aria-hidden className="live-dot inline-block size-1.5 rounded-full bg-[#177245] text-[#177245]" />LIVE
            </span>
          </h1>
          <p className="staff-sub" aria-live="polite">
            <strong className="tnum font-semibold text-[#1c1917]">{live.length}</strong> in store{unassigned.length ? <> · <strong className="font-semibold text-[#9a5b00]">{unassigned.length} waiting for FC</strong></> : " · everyone assigned"}
          </p>
        </div>
        <Link href="/today" className="group inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-[13.5px] font-semibold text-[#b4234d] transition-colors hover:bg-[#fbe9ef]"><span aria-hidden className="transition-transform duration-150 group-hover:-translate-x-0.5">←</span> Today</Link>
      </div>

      {/* Team load — calm, factual */}
      <Panel className="p-4 sm:px-5">
        <p className="staff-kicker mb-2.5">Team load</p>
        <div className="flex flex-wrap gap-2" aria-label="Team load">
          {salespeople.map((sp) => {
            const load = fcLoad(sp.id);
            return (
              <span key={sp.id} className={`inline-flex min-h-[38px] items-center gap-2 rounded-full border px-3 text-[13px] transition-colors ${load >= 3 ? "border-[#f0d48a] bg-[#fffdf5]" : "border-[#e8dfd6] bg-[#faf8f6]"}`}>
                <strong className="font-semibold text-[#1c1917]">{sp.name}</strong>
                <span className="tnum rounded-full bg-white px-2 py-0.5 text-[12px] font-semibold text-[#78716c] ring-1 ring-[#e8dfd6]">{load} active</span>
              </span>
            );
          })}
        </div>
      </Panel>

      {/* Customers not yet identified */}
      {identifying.length > 0 && (
        <Panel className="border-[#f0d48a] bg-[#fffdf5] p-5">
          <h2 className="text-[16px] font-semibold">{identifying.length} awaiting identification</h2>
          <p className="mt-0.5 text-[13px] text-[#78716c]">Open the walk-in to find or create the customer.</p>
          <div className="mt-3 grid gap-2.5 md:grid-cols-2">
            {identifying.map((v) => (
              <div key={v.id} className="rounded-xl border border-[#f0d48a] bg-white p-4">
                <p className="text-[15px] font-semibold">Identifying…</p>
                <p className="tnum text-[13px] text-[#78716c]">{timeAgo(v.arrivedAt)} in store</p>
                <Link href={`/walk-in?visit=${v.id}`} className="mt-2 inline-flex min-h-[44px] items-center rounded-lg bg-[#1c1917] px-4 text-[13.5px] font-semibold text-white">
                  Identify customer →
                </Link>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {unassigned.length > 0 && (
        <Panel className="border-[#f0d48a] bg-[#fffdf5] p-5">
          <h2 className="text-[16px] font-semibold">Waiting for FC — assign now</h2>
          <div className="mt-3 grid gap-2.5 md:grid-cols-2">
            {unassigned.map((v) => {
              const c = v.customerId ? getCustomer(v.customerId) : undefined;
              return (
                <div key={v.id} className="rounded-xl border border-[#f0d48a] bg-white p-4">
                  <p className="text-[15px] font-semibold">{c?.name || "Identifying…"}</p>
                  <p className="tnum text-[13px] text-[#78716c]">{timeAgo(v.arrivedAt)} in store</p>
                  <div className="mt-2">
                    <FCQuickAssign visitId={v.id} currentSpId={v.assignedSalespersonId} onAssign={quickAssign} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {live.length === 0 ? (
        <EmptyState
          title="Floor is clear."
          body="No active visits right now. New customers will appear here the moment a walk-in starts."
          action={<Link href="/today" className="btn-sheen inline-flex min-h-[48px] items-center rounded-xl bg-[#1c1917] px-5 text-[14px] font-semibold text-white transition-all duration-150 hover:-translate-y-px active:translate-y-0 active:scale-[0.98]">Go to Today →</Link>}
        />
      ) : (
        <>
          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {paged.pageItems.map((v) => {
              const c = v.customerId ? getCustomer(v.customerId) : undefined;
              const fc = spName(v.assignedSalespersonId);
              const statusLabelLive =
                v.status === "ACTIVE" ? "On the floor" : v.assignedSalespersonId ? "Assigned" : "Waiting";
              return (
                <Panel key={v.id} className="pressable flex flex-col gap-3 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/visits/${v.id}`} className="block truncate text-[15.5px] font-semibold tracking-tight text-[#1c1917] hover:text-[#b4234d] hover:underline hover:underline-offset-2">
                        {c?.name || "Identifying customer…"}
                      </Link>
                      <p className="tnum mt-0.5 text-[12.5px] text-[#78716c]">
                        {fc ? <><span className="font-semibold text-[#57534e]">FC: {fc}</span> · </> : <><span className="font-semibold text-[#9a5b00]">Unassigned</span> · </>}{timeAgo(v.arrivedAt)} in store
                      </p>
                    </div>
                    <StatusBadge value={v.status} label={statusLabelLive} />
                  </div>
                  <div className="flex min-w-0 gap-2 border-t border-[#e8dfd6] pt-3">
                    <Link href={`/visits/${v.id}`} className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-[#d6c9bb] px-4 text-[13.5px] font-semibold transition-all duration-150 hover:-translate-y-px hover:border-[#1c1917] hover:bg-[#faf8f6] active:translate-y-0">
                      Open
                    </Link>
                    {v.customerId && (
                      <div className="min-w-0 flex-1">
                        <FCQuickAssign visitId={v.id} currentSpId={v.assignedSalespersonId} onAssign={quickAssign} />
                      </div>
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>
          <PaginationControls
            page={paged.page} totalPages={paged.totalPages} total={paged.total}
            start={paged.start} end={paged.end} onPage={setPage}
          />
        </>
      )}
      {/* customers list referenced to keep the composite snapshot cache warm */}
      <span className="hidden">{customers.length}</span>
    </div>
  );
}

export default function FloorPage() {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" aria-label="Loading" className="staff-page">
          <div className="skeleton-soft h-8 w-44 rounded-xl" />
          <div className="skeleton-soft h-[54px] rounded-2xl" />
          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton-soft h-[140px] rounded-2xl" style={{ animationDelay: `${i * 110}ms` }} />
            ))}
          </div>
        </div>
      }
    >
      <FloorInner />
    </Suspense>
  );
}
