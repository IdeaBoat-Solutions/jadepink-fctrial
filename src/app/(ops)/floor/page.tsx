"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { AccessNote, Btn, EmptyNote } from "@/components/floor/ui";
import { DeleteVisitButton, FCQuickAssign } from "@/components/ops";
import { cn, timeAgo } from "@/lib/utils";
import { listFloorVisits, type FloorSummary, type VisitLive } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { canViewLiveFloor } from "@/lib/policy";
import { usePageTitle } from "@/hooks/use-page-title";

/* Fitting rooms are not yet their own table — this is the store's physical
   suite count (3 trial suites + the VIP salon), same set FCs pick from when
   assigning a visit (setVisitSuite). Occupancy below counts distinct suites
   currently held by an active visit against this fixed capacity. */
const FITTING_SUITES = ["Suite 01", "Suite 02", "Suite 03", "Salon VIP"];

/* A visit waits "urgently" once it has sat without an FC past this many
   minutes — mirrors the floor SLA called out in the mockup ("Wait Time
   Threshold > 2m"), not a stored setting. */
const URGENT_WAIT_MIN = 2;

function StatTile({ value, label, tone }: { value: string | number; label: string; tone?: "warn" | "danger" | "ok" }) {
  const toneClass =
    tone === "danger" ? "text-[var(--fp-drop)]" : tone === "warn" ? "text-[var(--fp-wait)]" : tone === "ok" ? "text-[var(--fp-ok)]" : "text-[var(--fp-ink)]";
  return (
    <div className="min-w-0 border-r border-[var(--fp-line)] px-4 py-3.5 last:border-r-0">
      <p className={cn("fp-num truncate text-[22px] font-semibold leading-none tracking-tight", toneClass)}>{value}</p>
      <p className="mt-1.5 truncate text-[11.5px] font-medium uppercase tracking-[0.06em] text-[var(--fp-muted)]">{label}</p>
    </div>
  );
}

export default function FloorPage() {
  usePageTitle("Live floor");
  const { salespeople, profile, user, visits, activeVisits, awaitingAssignment, createWalkIn, pushToast } = useStore();
  const router = useRouter();
  const [summaries, setSummaries] = useState<Map<string, FloorSummary>>(new Map());
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const storeId = profile?.storeId ?? null;

  const newWalkIn = async () => {
    if (creating) return;
    setCreating(true);
    const v = await createWalkIn();
    setCreating(false);
    if (!v) {
      pushToast("Could not record the walk-in", "Check your connection and try again.");
      return;
    }
    pushToast("Walk-in recorded", "Identify the customer next.");
    router.push(`/visits/${v.id}`);
  };

  const refresh = useCallback(async () => {
    if (!storeId) return;
    try {
      const r = await listFloorVisits(storeId);
      if (!r.ok) return;
      const next = new Map<string, FloorSummary>();
      for (const row of r.data) next.set(row.visit.id, row.summary);
      setSummaries(next);
    } catch { /* keep last numbers */ }
  }, [storeId]);

  useEffect(() => {
    const t0 = window.setTimeout(() => void refresh(), 0);
    const t = window.setInterval(() => void refresh(), 15000);
    return () => { window.clearTimeout(t0); window.clearInterval(t); };
  }, [refresh]);

  // Urgent-wait cards re-derive their minute count on a slow tick — no refetch needed.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!storeId || !isSupabaseConfigured()) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 400);
    };
    const channel = supabase
      .channel(`floor-os:${storeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "visit_products" }, fire)
      .on("postgres_changes", { event: "*", schema: "public", table: "visits", filter: `store_id=eq.${storeId}` }, fire)
      .subscribe();
    return () => { if (timer) clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [storeId, refresh]);

  const fcOf = (id: string | null, fallback?: string | null) => salespeople.find((s) => s.id === id)?.name || fallback || "Unassigned";
  const active = activeVisits.filter((v) => v.status === "ACTIVE" || (v.status === "ASSIGNED" && v.assignedSalespersonId));
  const urgent = awaitingAssignment.filter((v) => (now - new Date(v.arrivedAt).getTime()) / 60_000 >= URGENT_WAIT_MIN);
  const waiting = awaitingAssignment.filter((v) => !urgent.includes(v));

  // Store-wide totals for the header strip — every number below reads
  // straight off live data (today's visits + this refresh's floor summaries),
  // nothing fabricated for the mockup's sake.
  const stats = (() => {
    const completedToday = visits.filter((v) => v.status === "COMPLETED").length;
    const occupiedSuites = new Set(active.map((v) => v.suite).filter((s): s is string => !!s));
    let trials = 0, liked = 0, dropped = 0;
    for (const v of active) {
      const s = summaries.get(v.id);
      if (!s) continue;
      trials += s.trialInProgress + s.trialCompleted;
      liked += s.liked;
      dropped += s.dropped;
    }
    return {
      walkIns: visits.length,
      active: active.length,
      awaiting: awaitingAssignment.length,
      completed: completedToday,
      suitesUsed: occupiedSuites.size,
      trials, liked, dropped,
    };
  })();

  if (user && !canViewLiveFloor(user.role)) {
    return (
      <AccessNote
        title="Live floor is a manager view."
        body="Your work is the customer in front of you. Open My visits to continue a fitting."
        action={<Btn tone="brand" onClick={() => router.push("/today")}>Back to my work</Btn>}
      />
    );
  }

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-2 text-[13px] text-[var(--fp-muted)]">
        <Link href="/today" className="font-semibold text-[var(--fp-brand)]">Store</Link>
        <span aria-hidden className="mx-1.5">/</span>
        <span aria-current="page" className="text-[var(--fp-ink)]">Live telemetry</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight sm:text-[26px]">Manager Command Center</h1>
          <p className="mt-1 text-[13.5px] text-[var(--fp-muted)]">
            Floor lead: <span className="font-semibold text-[var(--fp-ink)]">{user?.name}</span>
            <span className="mx-2 text-[var(--fp-line-strong)]">·</span>
            Auto-sync every 15s
          </p>
        </div>
        <Btn tone="brand" onClick={() => void newWalkIn()} disabled={creating}>
          {creating ? "Recording…" : "+ New walk-in"}
        </Btn>
      </div>

      <dl className="mt-6 grid grid-cols-2 border border-[var(--fp-line)] sm:grid-cols-4 lg:grid-cols-8">
        <StatTile value={stats.walkIns} label="Walk-ins today" />
        <StatTile value={stats.active} label="Active visits" tone="ok" />
        <StatTile value={stats.awaiting} label="Awaiting staff" tone={stats.awaiting > 0 ? "warn" : undefined} />
        <StatTile value={stats.completed} label="Completed" />
        <StatTile value={`${stats.suitesUsed}/${FITTING_SUITES.length}`} label="Fitting rooms" />
        <StatTile value={stats.trials} label="Trials run" />
        <StatTile value={stats.liked} label="Items liked" tone="ok" />
        <StatTile value={stats.dropped} label="Items dropped" tone={stats.dropped > 0 ? "danger" : undefined} />
      </dl>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">
              Live floor · real-time active visits
            </h2>
            <span className="text-[12.5px] text-[var(--fp-muted)]">
              {stats.active} active{urgent.length > 0 && <> · <span className="font-semibold text-[var(--fp-drop)]">{urgent.length} urgent</span></>}
            </span>
          </div>

          {urgent.length === 0 && active.length === 0 && waiting.length === 0 && (
            <EmptyNote title="The floor is quiet." body="New walk-ins and active fittings will appear here the moment they're recorded." />
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {urgent.map((v) => (
              <UrgentCard key={v.id} v={v} />
            ))}
            {active.map((v) => (
              <ActiveCard key={v.id} v={v} summary={summaries.get(v.id)} fcName={fcOf(v.assignedSalespersonId, v.fcName)} />
            ))}
            {waiting.map((v) => (
              <WaitingCard key={v.id} v={v} />
            ))}
          </div>
        </div>

        <aside className="min-w-0">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">
            Sales team on floor
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {salespeople.map((sp) => {
              const spVisits = active.filter((v) => v.assignedSalespersonId === sp.id);
              const busy = spVisits.length > 0;
              return (
                <li key={sp.id} className="border border-[var(--fp-line)] bg-[var(--fp-surface)] px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[14.5px] font-semibold text-[var(--fp-ink)]">{sp.name}</p>
                    <span className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide",
                      !sp.active ? "bg-[var(--fp-ink-soft)] text-[var(--fp-muted)]" : busy ? "bg-[var(--fp-wait-bg)] text-[var(--fp-wait)]" : "bg-[var(--fp-ok-bg)] text-[var(--fp-ok)]"
                    )}>
                      {!sp.active ? "Off" : busy ? "Busy" : "Available"}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--fp-muted)]">
                    {spVisits.length > 0
                      ? spVisits.map((v) => v.customerName || "Customer").join(", ")
                      : "No active customer"}
                  </p>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}

/* ---------- Urgent: identified (or not) but no FC past the SLA ---------- */
function UrgentCard({ v }: { v: VisitLive }) {
  return (
    <div className="col-span-full border-2 border-[var(--fp-drop)] bg-[var(--fp-drop-bg)]/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center rounded-md bg-[var(--fp-drop)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            Urgent wait
          </span>
          <p className="fp-name mt-2 truncate text-[22px] leading-none">{v.customerName || "Unidentified customer"}</p>
          <p className="mt-1 text-[13px] text-[var(--fp-muted)]">Unassigned · waiting {timeAgo(v.arrivedAt)}</p>
        </div>
        <div className="w-full shrink-0 sm:w-[240px]">
          {v.customerId ? (
            <FCQuickAssign visitId={v.id} currentSpId={v.assignedSalespersonId ?? null} />
          ) : (
            <Link href={`/visits/${v.id}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--fp-drop)] px-4 text-[14px] font-semibold text-white">
              Identify now
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Waiting: identified, no urgency yet, or still unidentified ---------- */
function WaitingCard({ v }: { v: VisitLive }) {
  return (
    <div className="border border-dashed border-[var(--fp-line-strong)] bg-[var(--fp-surface)] p-4">
      <p className="fp-name truncate text-[20px] leading-none">{v.customerName || "Unidentified customer"}</p>
      <p className="mt-1 text-[13px] text-[var(--fp-muted)]">Arrived {timeAgo(v.arrivedAt)} ago</p>
      <div className="mt-3 flex items-center gap-2">
        {v.customerId ? (
          <div className="min-w-0 flex-1"><FCQuickAssign visitId={v.id} currentSpId={v.assignedSalespersonId ?? null} /></div>
        ) : (
          <Link href={`/visits/${v.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-[var(--fp-brand)] px-4 text-[14px] font-semibold text-white">Identify</Link>
        )}
        <DeleteVisitButton visitId={v.id} name={v.customerName || "Unidentified"} />
      </div>
    </div>
  );
}

/* ---------- Active: on the floor, trialling ---------- */
function ActiveCard({ v, summary, fcName }: { v: VisitLive; summary?: FloorSummary; fcName: string }) {
  const trialled = summary ? summary.trialInProgress + summary.trialCompleted : 0;
  const total = summary ? summary.liked + summary.dropped : 0;
  const likedPct = total > 0 ? Math.round((summary!.liked / total) * 100) : 0;
  return (
    <div className="border border-[var(--fp-line)] bg-[var(--fp-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="fp-name truncate text-[20px] leading-none">{v.customerName || "Customer"}</p>
          <p className="mt-1 text-[12.5px] text-[var(--fp-muted)]">
            FC {fcName}{v.suite && <> · {v.suite}</>}
          </p>
        </div>
        <span className="fp-num shrink-0 text-[13px] font-semibold text-[var(--fp-muted)]">{timeAgo(v.startedAt || v.arrivedAt)}</span>
      </div>

      {summary && (
        <>
          <p className="fp-num mt-3 text-[12.5px] text-[var(--fp-muted)]">
            <span className="font-semibold text-[var(--fp-ink)]">{summary.selected}</span> selected
            <span className="mx-1.5 text-[var(--fp-line-strong)]">·</span>
            <span className="font-semibold text-[var(--fp-ink)]">{trialled}</span> trialled
            <span className="mx-1.5 text-[var(--fp-line-strong)]">·</span>
            <span className="font-semibold text-[var(--fp-ok)]">{summary.liked}</span> liked
            <span className="mx-1.5 text-[var(--fp-line-strong)]">·</span>
            <span className="font-semibold text-[var(--fp-drop)]">{summary.dropped}</span> dropped
          </p>
          {total > 0 && (
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--fp-drop-bg)]">
              <div className="h-full bg-[var(--fp-ok)]" style={{ width: `${likedPct}%` }} />
            </div>
          )}
        </>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <Link href={`/visits/${v.id}`} className="inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-lg bg-[var(--fp-ink)] px-3 text-[13.5px] font-semibold text-white hover:bg-black">
          View live visit
        </Link>
        <FCQuickAssign visitId={v.id} currentSpId={v.assignedSalespersonId ?? null} />
      </div>
    </div>
  );
}
