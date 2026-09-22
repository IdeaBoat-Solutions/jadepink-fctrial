"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { AccessNote, Btn, EmptyNote, ErrorNote, Metric } from "@/components/floor/ui";
import { canViewLiveFloor } from "@/lib/policy";
import { getSalesSummary, type FloorVisit, type SalesSummary } from "@/lib/api";
import type { VisitWithProductsDTO } from "@/features/visits/products/dto";
import { formatINR } from "@/lib/utils";

type SalesState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "error" }
  | { status: "ready"; data: SalesSummary };

export default function ActivityPage() {
  const { user, profile, todayCounts, activeVisits } = useStore();
  const router = useRouter();
  const [reasons, setReasons] = useState<Array<[string, number]> | null>(null);
  const [totals, setTotals] = useState({ trials: 0, liked: 0, dropped: 0 });
  const [floorFailed, setFloorFailed] = useState(false);
  const [sales, setSales] = useState<SalesState>({ status: "loading" });

  useEffect(() => {
    const storeId = profile?.storeId;
    if (!storeId || user?.role !== "manager") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/visits/floor?storeId=${encodeURIComponent(storeId)}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error("floor");
        const rows = (json.data ?? []) as FloorVisit[];
        const tally = { trials: 0, liked: 0, dropped: 0 };
        const reasonMap = new Map<string, number>();
        await Promise.all(rows.map(async (row) => {
          tally.trials += row.summary.trialInProgress + row.summary.trialCompleted;
          tally.liked += row.summary.liked;
          tally.dropped += row.summary.dropped;
          if (row.summary.dropped === 0) return;
          const pr = await fetch(`/api/visits/${row.visit.id}/products`, { cache: "no-store" });
          const pj = await pr.json().catch(() => ({}));
          if (!pr.ok) return;
          const data = pj.data as VisitWithProductsDTO;
          for (const p of data.products ?? []) {
            if (p.status === "DROPPED" && p.dropReason) {
              reasonMap.set(p.dropReason.label, (reasonMap.get(p.dropReason.label) ?? 0) + 1);
            }
          }
        }));
        if (cancelled) return;
        setTotals(tally);
        setReasons([...reasonMap.entries()].sort((a, b) => b[1] - a[1]));
      } catch {
        if (!cancelled) setFloorFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.storeId, user?.role]);

  useEffect(() => {
    if (user?.role !== "manager") return;
    let cancelled = false;
    void (async () => {
      const r = await getSalesSummary();
      if (cancelled) return;
      if (!r.ok) { setSales({ status: "error" }); return; }
      if (r.data.source === "none") { setSales({ status: "none" }); return; }
      setSales({ status: "ready", data: r.data });
    })();
    return () => { cancelled = true; };
  }, [user?.role]);

  if (user && !canViewLiveFloor(user.role)) {
    return (
      <AccessNote
        title="Store reports are for the manager."
        body="Your screen stays on the customer you are serving."
        action={<Btn tone="brand" onClick={() => router.push("/today")}>Back to my work</Btn>}
      />
    );
  }

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-tight">Store activity</h1>
      <p className="mt-1 text-[14px] text-[var(--fp-muted)]">Billed sales and floor work. Counts from the register and the floor — never estimates.</p>

      <section aria-label="Sales" className="mt-6">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">Sales</h2>
        {sales.status === "loading" && <div className="fp-skel mt-3 h-20" aria-busy="true" aria-label="Loading sales" />}
        {sales.status === "none" && (
          <p className="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-[var(--fp-muted)]">
            Sales figures appear here once the store backend is connected. Nothing is estimated in the meantime.
          </p>
        )}
        {sales.status === "error" && (
          <div className="mt-3">
            <ErrorNote
              title="Could not load sales."
              body="Check your connection and try again."
              action={<Btn tone="line" onClick={() => window.location.reload()}>Reload</Btn>}
            />
          </div>
        )}
        {sales.status === "ready" && (
          <>
            <dl className="mt-3 grid grid-cols-2 divide-x divide-[var(--fp-line)] border-y border-[var(--fp-line)] sm:grid-cols-4">
              <Metric value={formatINR(sales.data.today.revenue)} label={`Today · ${sales.data.today.orders} bills`} />
              <Metric value={formatINR(sales.data.week.revenue)} label={`Last 7 days · ${sales.data.week.orders} bills`} />
              <Metric value={todayCounts.walkIns} label="Walk-ins today" />
              <Metric value={activeVisits.length} label="Still on the floor" />
            </dl>
            <div className="mt-5">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">Sales by FC · last 7 days</h3>
              {sales.data.week.byFc.length === 0 ? (
                <EmptyNote title="No sales recorded in the last 7 days." body="Billed sales appear here with the FC recorded on each bill." />
              ) : (
                <ul className="mt-2 max-w-md">
                  {sales.data.week.byFc.map((row) => (
                    <li key={row.name} className="flex items-baseline justify-between gap-3 border-b border-[var(--fp-line)] py-2.5">
                      <span className="text-[15px]">{row.name} <span className="fp-num text-[13px] text-[var(--fp-muted)]">· {row.orders} bills</span></span>
                      <span className="fp-num text-[16px] font-semibold">{formatINR(row.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>

      <section className="mt-8" aria-label="Floor work">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">On the floor now</h2>
        <dl className="mt-3 grid grid-cols-3 divide-x divide-[var(--fp-line)] border-y border-[var(--fp-line)]">
          <Metric value={totals.trials} label="Trials open" />
          <Metric value={totals.liked} label="Liked" />
          <Metric value={totals.dropped} label="Dropped" />
        </dl>
        <h3 className="mt-5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">Drop reasons · on the floor now</h3>
        {floorFailed && <p className="mt-3 text-[14px] text-[var(--fp-drop)]">We couldn&apos;t load drop reasons. The floor list is still available.</p>}
        {!floorFailed && reasons === null && <div className="fp-skel mt-3 h-20" aria-busy="true" aria-label="Loading drop reasons" />}
        {reasons && reasons.length === 0 && <EmptyNote title="No products have been dropped yet today." body="Reasons appear here as soon as a salesperson records one." />}
        {reasons && reasons.length > 0 && (
          <ul className="mt-2 max-w-md">
            {reasons.map(([label, n]) => (
              <li key={label} className="flex items-baseline justify-between border-b border-[var(--fp-line)] py-2.5">
                <span className="text-[15px]">{label}</span>
                <span className="fp-num text-[18px] font-semibold">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
