"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Btn, EmptyNote, Metric, StatusMark } from "@/components/floor/ui";
import { DeleteVisitButton, EndVisitButton, FCQuickAssign } from "@/components/ops";
import { cn, greeting, timeAgo } from "@/lib/utils";
import { listFloorVisits, type FloorSummary, type VisitLive } from "@/lib/api";
import { usePageTitle } from "@/hooks/use-page-title";

export default function TodayPage() {
  usePageTitle("Today");
  const { user, profile, visits, todayCounts, activeVisits, awaitingAssignment, createWalkIn, pushToast, salespeople } = useStore();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const isManager = user?.role === "manager";
  const first = user?.name?.split(" ")[0] || "there";

  const newWalkIn = async () => {
    if (creating) return;
    setCreating(true);
    const v = await createWalkIn();
    setCreating(false);
    if (!v) {
      pushToast("Could not record the walk-in", "Check your connection and try again.");
      return;
    }
    router.push(`/visits/${v.id}`);
  };

  const nameOf = (v: (typeof visits)[number]) => v.customerName || "Unidentified customer";
  const fcOf = (id: string | null) => salespeople.find((s) => s.id === id)?.name;

  if (!isManager) {
    return <SalespersonTerminal
      first={first}
      visits={visits}
      userId={user?.id ?? null}
      storeId={profile?.storeId ?? null}
      creating={creating}
      onWalkIn={() => void newWalkIn()}
      nameOf={nameOf}
    />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="fp-display text-[27px] leading-none sm:text-[32px]">{greeting()}, {first}</h1>
          <p className="mt-2 text-[14px] text-[var(--fp-muted)]">
            Today&apos;s store activity
          </p>
        </div>
        <Btn tone="brand" className="min-w-[180px] min-h-12 text-[15px]" onClick={() => router.push("/floor")}>
          Open live floor
        </Btn>
      </div>

      <dl className="mt-6 grid grid-cols-2 divide-x divide-[var(--fp-line)] border-y border-[var(--fp-line)] sm:grid-cols-4">
        <Metric value={todayCounts.walkIns} label="Store walk-ins" />
        <Metric value={todayCounts.active} label="Active visits" />
        <Metric value={visits.filter((v) => v.status === "COMPLETED").length} label="Completed" />
        <Metric value={todayCounts.awaiting} label="Awaiting assignment" warn={todayCounts.awaiting > 0} />
      </dl>

      <section className="mt-8" aria-label="Store activity">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="fp-kicker text-[var(--fp-faint)]">
            Needs attention
          </h2>
          <Link href="/floor" className="text-[13.5px] font-semibold text-[var(--fp-brand)]">All active visits</Link>
        </div>

        {awaitingAssignment.length > 0 && (
          <ul className="mt-3">
            {awaitingAssignment.slice(0, 4).map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fp-line)] py-3.5">
                <div className="min-w-0">
                  <p className="fp-name text-[22px] leading-none">{nameOf(v)}</p>
                  <p className="mt-1 text-[13px] text-[var(--fp-muted)]">Arrived {timeAgo(v.arrivedAt)} ago</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {v.customerId ? (
                    <div className="w-full min-w-0 sm:w-auto sm:min-w-[220px]"><FCQuickAssign visitId={v.id} currentSpId={v.assignedSalespersonId ?? null} /></div>
                  ) : (
                    <Link href={`/visits/${v.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-[var(--fp-brand)] px-4 text-[14px] font-semibold text-white">Identify</Link>
                  )}
                  <DeleteVisitButton visitId={v.id} name={nameOf(v)} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {awaitingAssignment.length === 0 && activeVisits.length === 0 && (
          <EmptyNote title="No customers are currently active." body="The floor is quiet. New walk-ins will appear here the moment they are recorded." />
        )}

        {activeVisits.length > 0 && (
          <div className="mt-6">
            <h2 className="fp-kicker text-[var(--fp-faint)]">On the floor</h2>
            <ul className="mt-2">
              {activeVisits.slice(0, 6).map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fp-line)] py-3">
                  <div>
                    <p className="text-[16px] font-semibold">{nameOf(v)}</p>
                    <p className="text-[13px] text-[var(--fp-muted)]">FC {fcOf(v.assignedSalespersonId) || v.fcName || "Unassigned"} · {timeAgo(v.startedAt || v.arrivedAt)}</p>
                  </div>
                  <Link href={`/visits/${v.id}`} className="text-[14px] font-semibold text-[var(--fp-brand)]">View visit</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- Salesperson floor terminal ----------
   The FC's whole shift in one glance: who is next, who else waits, one
   thumb-sized action. Numbered queue positions instead of stat tiles —
   "you are 2nd in line" needs no explaining. The workspace at
   /visits/[id] does the doing. */

type Step =
  | { kind: "identify"; label: string; cta: string }
  | { kind: "take"; label: string; cta: string }
  | { kind: "continue"; label: string; cta: string }
  | { kind: "start"; label: string; cta: string };

function nextStep(v: VisitLive): Step {
  if (!v.customerId) return { kind: "identify", label: "Just walked in · needs a name", cta: "Identify" };
  if (!v.assignedSalespersonId) return { kind: "take", label: "Nobody with them yet", cta: "Take customer" };
  if (v.status === "ACTIVE") return { kind: "continue", label: "Trying clothes on with you", cta: "Continue visit" };
  return { kind: "start", label: "Assigned to you · ready", cta: "Start visit" };
}

function waitLine(v: VisitLive, step: Step): string {
  const ago = timeAgo(v.arrivedAt);
  if (step.kind === "continue") return `With you · ${ago} in`;
  return `Waiting ${ago} · ${step.label.charAt(0).toLowerCase()}${step.label.slice(1)}`;
}

function SalespersonTerminal({
  first, visits, userId, storeId, creating, onWalkIn, nameOf,
}: {
  first: string;
  visits: VisitLive[];
  userId: string | null;
  storeId: string | null;
  creating: boolean;
  onWalkIn: () => void;
  nameOf: (v: VisitLive) => string;
}) {
  const router = useRouter();
  const { assignSalesperson, pushToast } = useStore();
  const [taking, setTaking] = useState(false);
  const [summaries, setSummaries] = useState<Map<string, FloorSummary>>(new Map());
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

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

  const OPEN = ["ARRIVED", "IDENTIFYING", "ASSIGNED", "ACTIVE"];
  const mine = visits.filter((v) => v.assignedSalespersonId && v.assignedSalespersonId === userId && OPEN.includes(v.status));
  const queue = visits.filter((v) => !v.assignedSalespersonId && OPEN.includes(v.status));
  const myDone = visits.filter((v) => v.assignedSalespersonId === userId && v.status === "COMPLETED");
  const myLive = mine.filter((v) => v.status === "ACTIVE");
  const myWalkIns = visits.filter((v) => v.assignedSalespersonId === userId).length;

  // Trial conversion: liked / (liked+dropped) across today's visits assigned
  // to me, from the same floor-summary numbers /floor uses. "—" until a
  // summary has actually loaded — never a fabricated placeholder %.
  let likedSum = 0, droppedSum = 0;
  for (const v of mine) {
    const s = summaries.get(v.id);
    if (!s) continue;
    likedSum += s.liked;
    droppedSum += s.dropped;
  }
  const conversionTotal = likedSum + droppedSum;
  const conversionPct = conversionTotal > 0 ? Math.round((likedSum / conversionTotal) * 100) : null;

  const takeCustomer = async (v: VisitLive) => {
    if (!userId || taking) return;
    setTaking(true);
    const r = await assignSalesperson(v.id, userId);
    setTaking(false);
    if (r.ok) router.push(`/visits/${v.id}`);
    else pushToast("Could not take customer", r.message ?? "Try again.");
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="fp-kicker text-[var(--fp-faint)]">{today}</p>
          <h1 className="fp-display mt-1.5 text-[32px] leading-none sm:text-[36px]">{greeting()}, {first}</h1>
          <p className="mt-2 text-[13.5px] text-[var(--fp-muted)]">Today&apos;s store activity</p>
        </div>
        <Btn tone="brand" onClick={onWalkIn} disabled={creating} className="min-h-12 w-full px-5 text-[15px] sm:w-auto sm:min-w-[180px]">
          {creating ? "Recording…" : "+ New walk-in"}
        </Btn>
      </div>

      <dl className="mt-6 grid grid-cols-2 divide-x divide-[var(--fp-line)] border-y border-[var(--fp-line)] sm:grid-cols-4">
        <Metric value={myWalkIns} label="My walk-ins" />
        <Metric value={myLive.length} label="Active in-store" />
        <Metric value={myDone.length} label="Completed today" />
        <Metric value={conversionPct === null ? "—" : `${conversionPct}%`} label="Trial conversion" />
      </dl>

      <section className="mt-8" aria-label="Active floor engagements">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="fp-kicker text-[var(--fp-faint)]">
            Active floor engagements · {mine.length} in progress
          </h2>
        </div>

        {mine.length === 0 ? (
          <div className="mt-3">
            <EmptyNote title="Nobody's with you yet." body="Take a customer from the queue below, or record a new walk-in." />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {mine.map((v) => (
              <EngagementCard key={v.id} v={v} name={nameOf(v)} summary={summaries.get(v.id)} />
            ))}
          </div>
        )}

        {queue.length > 0 && (
          <div className="mt-6">
            <h3 className="fp-kicker text-[var(--fp-faint)]">Waiting for someone · {queue.length}</h3>
            <ol className="mt-2 divide-y divide-[var(--fp-line)] border-y border-[var(--fp-line)]">
              {queue.map((v) => {
                const s = nextStep(v);
                return (
                  <li key={v.id} className="flex items-center gap-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="fp-name block truncate text-[17px]">{nameOf(v)}</span>
                      <span className="fp-num mt-0.5 block text-[12.5px] text-[var(--fp-muted)]">{waitLine(v, s)}</span>
                    </span>
                    {s.kind === "take" ? (
                      <Btn tone="brand" onClick={() => void takeCustomer(v)} disabled={taking} className="min-h-10 shrink-0 px-3.5 text-[13.5px]">
                        {taking ? "Taking…" : "Take customer"}
                      </Btn>
                    ) : (
                      <Link href={`/visits/${v.id}`} className="shrink-0 text-[13.5px] font-semibold text-[var(--fp-brand)]">{s.cta}</Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

      <section className="mt-8" aria-label="Recent visits">
        <h2 className="fp-kicker text-[var(--fp-faint)]">Awaiting re-engagement &amp; recent visits</h2>
        {myDone.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-[var(--fp-muted)]">No visits closed out today yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--fp-line)] border-y border-[var(--fp-line)]">
            {myDone.slice(0, 6).map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="fp-name truncate text-[16px] leading-none">{nameOf(v)}</p>
                  <p className="mt-1 text-[12.5px] text-[var(--fp-muted)]">
                    Completed {v.completedAt ? timeAgo(v.completedAt) : timeAgo(v.arrivedAt)} ago
                  </p>
                </div>
                <Link href={`/visits/${v.id}`} className="shrink-0 text-[13.5px] font-semibold text-[var(--fp-brand)]">View visit</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* One card per customer currently with me (or assigned + waiting to start).
   Mirrors the ActiveCard on /floor, scoped to just my own visits. */
function EngagementCard({ v, name, summary }: { v: VisitLive; name: string; summary?: FloorSummary }) {
  const s = nextStep(v);
  const active = v.status === "ACTIVE";
  const trialled = summary ? summary.trialInProgress + summary.trialCompleted : 0;
  const total = summary ? summary.liked + summary.dropped : 0;
  const likedPct = total > 0 ? Math.round((summary!.liked / total) * 100) : 0;

  return (
    <div className="border border-[var(--fp-line)] bg-[var(--fp-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="fp-name truncate text-[19px] leading-none">{name}</p>
          <p className="mt-1 text-[12.5px] text-[var(--fp-muted)]">{waitLine(v, s)}</p>
        </div>
        <StatusMark value={active ? "active" : "waiting"} label={active ? "With you" : "Ready"} />
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

      <div className="mt-3 flex items-center gap-2">
        <Link
          href={`/visits/${v.id}`}
          className={cn(
            "inline-flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 text-[13.5px] font-semibold text-white",
            active ? "bg-[var(--fp-ink)] hover:bg-black" : "bg-[var(--fp-brand)] hover:bg-[var(--fp-brand-deep)]",
          )}
        >
          {s.cta}
        </Link>
      </div>
      <div className="mt-2">
        <EndVisitButton visitId={v.id} name={name} className="min-h-9 w-full border-transparent bg-transparent px-0 text-[12.5px] underline underline-offset-2" />
      </div>
    </div>
  );
}

