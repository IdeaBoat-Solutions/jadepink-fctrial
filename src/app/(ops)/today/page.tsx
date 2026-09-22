"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Btn, EmptyNote, Metric, StatusMark } from "@/components/floor/ui";
import { DeleteVisitButton, EndVisitButton, FCQuickAssign } from "@/components/ops";
import { greeting, timeAgo, clockTime } from "@/lib/utils";
import type { VisitLive } from "@/lib/api";

export default function TodayPage() {
  const { user, visits, todayCounts, activeVisits, awaitingAssignment, createWalkIn, pushToast, salespeople } = useStore();
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
      creating={creating}
      onWalkIn={() => void newWalkIn()}
      nameOf={nameOf}
    />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{greeting()}, {first}</h1>
          <p className="mt-1 text-[14px] text-[var(--fp-muted)]">
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
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">
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
                    <div className="min-w-[220px]"><FCQuickAssign visitId={v.id} currentSpId={v.assignedSalespersonId ?? null} /></div>
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
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">On the floor</h2>
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

/* ---------- Salesperson arrival terminal ----------
   The FC's whole morning in one glance: who needs identification, who needs
   an FC, who is already on the floor with them. Every row names its next
   step — the workspace at /visits/[id] does the doing. */

function nextStep(v: VisitLive): { label: string; cta: string; mark: string; kicker: string } {
  if (!v.customerId) return { label: "Needs identification", cta: "Identify", mark: "waiting", kicker: "Next to take" };
  if (!v.assignedSalespersonId) return { label: "Waiting for an FC", cta: "Take customer", mark: "waiting", kicker: "Next to take" };
  if (v.status === "ACTIVE") return { label: "Fitting in progress", cta: "Continue visit", mark: "active", kicker: "With you now" };
  return { label: "Assigned — ready to start", cta: "Start visit", mark: "selected", kicker: "Ready to start" };
}

function monogram(name: string): string {
  const p = name.trim().split(/\s+/);
  return (((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase()) || "?";
}

function SalespersonTerminal({
  first, visits, userId, creating, onWalkIn, nameOf,
}: {
  first: string;
  visits: VisitLive[];
  userId: string | null;
  creating: boolean;
  onWalkIn: () => void;
  nameOf: (v: VisitLive) => string;
}) {
  const OPEN = ["ARRIVED", "IDENTIFYING", "ASSIGNED", "ACTIVE"];
  const mine = visits.filter((v) => v.assignedSalespersonId && v.assignedSalespersonId === userId && OPEN.includes(v.status));
  const myLive = mine.filter((v) => v.status === "ACTIVE");
  const myPending = mine.filter((v) => v.status !== "ACTIVE");
  const queue = visits.filter((v) => !v.assignedSalespersonId && OPEN.includes(v.status));
  const myDone = visits.filter((v) => v.assignedSalespersonId === userId && v.status === "COMPLETED").length;

  /* One ordered spine: whoever I'm serving comes first, then my assigned
     pending, then the unclaimed queue. The top of that spine is the single
     thing to do next — everything else is the rail. */
  const ordered = [...myLive, ...myPending, ...queue];
  const hero = ordered[0] ?? null;
  const rail = ordered.slice(1);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{greeting()}, {first}</h1>
          <p className="mt-1 text-[14px] text-[var(--fp-muted)]">Your floor terminal — one next step at a time.</p>
        </div>
        <Btn tone="brand" onClick={onWalkIn} disabled={creating} className="min-w-[180px] min-h-12 text-[15px]">
          {creating ? "Recording…" : "New walk-in"}
        </Btn>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-[var(--fp-line)] py-3 text-[13.5px]">
        <p className="font-semibold">Ahmedabad Flagship</p>
        <p className="fp-num text-[var(--fp-muted)]"><span className="font-semibold text-[var(--fp-ink)]">{mine.length + queue.length}</span> in your orbit</p>
        <p className="fp-num text-[var(--fp-muted)]"><span className="font-semibold text-[var(--fp-ink)]">{myLive.length}</span> with you</p>
        <p className="fp-num text-[var(--fp-muted)]"><span className="font-semibold text-[var(--fp-ink)]">{queue.length}</span> waiting</p>
        <p className="fp-num text-[var(--fp-muted)]"><span className="font-semibold text-[var(--fp-ink)]">{myDone}</span> completed</p>
      </div>

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {/* MAIN: the single next customer */}
        <div className="min-w-0">
          {hero ? <HeroNext v={hero} nameOf={nameOf} /> : <HeroEmpty creating={creating} onWalkIn={onWalkIn} />}
        </div>

        {/* RAIL: everyone else in the queue */}
        <aside className="min-w-0 rounded-xl border border-[var(--fp-line)] bg-[var(--fp-surface)]">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--fp-line)] px-4 py-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--fp-faint)]">Your floor</h2>
            <span className="fp-num text-[12px] font-semibold text-[var(--fp-muted)]">{rail.length}</span>
          </div>
          {rail.length === 0 ? (
            <p className="px-4 py-6 text-[13.5px] leading-relaxed text-[var(--fp-muted)]">
              {hero ? "No one else waiting. Take your time here." : "The floor is quiet."}
            </p>
          ) : (
            <ul>
              {rail.map((v) => {
                const s = nextStep(v);
                return (
                  <li key={v.id}>
                    <Link href={`/visits/${v.id}`} className="flex items-center gap-3 border-b border-[var(--fp-line)] px-4 py-3 last:border-b-0 hover:bg-[var(--fp-ink-soft)]">
                      <span aria-hidden className="fp-num grid size-9 shrink-0 place-items-center rounded-full bg-[var(--fp-brand-soft)] text-[13px] font-semibold text-[var(--fp-brand-deep)]">
                        {monogram(nameOf(v))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{nameOf(v)}</span>
                        <span className="fp-num block text-[12.5px] text-[var(--fp-muted)]">{s.label} · {timeAgo(v.arrivedAt)} ago</span>
                      </span>
                      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${s.mark === "active" ? "bg-[var(--fp-ok)]" : "bg-[var(--fp-wait)]"}`} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {myDone > 0 && (
            <p className="fp-num border-t border-[var(--fp-line)] px-4 py-3 text-[12.5px] text-[var(--fp-muted)]">
              <span className="font-semibold text-[var(--fp-ink)]">{myDone}</span> completed today
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

/* Hero: the one customer the FC should act on right now. Big, calm, single CTA. */
function HeroNext({ v, nameOf }: { v: VisitLive; nameOf: (v: VisitLive) => string }) {
  const s = nextStep(v);
  const active = v.status === "ACTIVE";
  const theirs = !v.assignedSalespersonId;
  return (
    <section aria-label="Next step" className="rounded-2xl border border-[var(--fp-line)] bg-[var(--fp-surface)] p-6 shadow-[var(--fp-shadow)] sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--fp-brand-deep)]">{s.kicker}</p>
        <StatusMark value={s.mark} label={s.label} />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <span aria-hidden className="fp-num grid size-14 shrink-0 place-items-center rounded-full bg-[var(--fp-brand-soft)] text-[20px] font-semibold text-[var(--fp-brand-deep)]">
          {monogram(nameOf(v))}
        </span>
        <div className="min-w-0">
          <h2 className="fp-name text-[32px] leading-none">{nameOf(v)}</h2>
          <p className="fp-num mt-2 text-[13.5px] text-[var(--fp-muted)]">
            {active
              ? `On the floor · ${timeAgo(v.startedAt || v.arrivedAt)}`
              : `Arrived ${clockTime(v.arrivedAt)} · ${timeAgo(v.arrivedAt)} ago${theirs ? " · Unassigned" : ""}`}
          </p>
        </div>
      </div>
      {theirs && v.customerId && (
        <div className="mt-5 border-t border-[var(--fp-line)] pt-4">
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">Assign an FC</p>
          <FCQuickAssign visitId={v.id} currentSpId={v.assignedSalespersonId ?? null} />
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link
          href={`/visits/${v.id}`}
          className={`inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 text-[15px] font-semibold text-white sm:w-auto sm:min-w-[220px] ${active ? "bg-[var(--fp-ink)] hover:bg-black" : "bg-[var(--fp-brand)] hover:bg-[var(--fp-brand-deep)]"}`}
        >
          {s.cta}
        </Link>
        <EndVisitButton visitId={v.id} name={nameOf(v)} className="min-h-12 w-full sm:w-auto" />
      </div>
    </section>
  );
}


/* Nothing needs action: calm, not broken. Point at the two ways work starts. */
function HeroEmpty({ creating, onWalkIn }: { creating: boolean; onWalkIn: () => void }) {
  return (
    <section aria-label="Floor clear" className="rounded-2xl border border-dashed border-[var(--fp-line-strong)] bg-[var(--fp-surface)] p-7">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--fp-faint)]">All clear</p>
      <h2 className="fp-name mt-2 text-[28px] leading-none">The floor is quiet.</h2>
      <p className="mt-2 max-w-[46ch] text-[14.5px] leading-relaxed text-[var(--fp-muted)]">
        No one is waiting on you. When someone walks in, record them here — the workspace takes it from there.
      </p>
      <Btn tone="brand" onClick={onWalkIn} disabled={creating} className="mt-5 min-h-12 px-5 text-[15px]">
        {creating ? "Recording…" : "New walk-in"}
      </Btn>
    </section>
  );
}

