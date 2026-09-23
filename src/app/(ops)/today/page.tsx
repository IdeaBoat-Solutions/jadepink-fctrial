"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Btn, EmptyNote, Metric, StatusMark } from "@/components/floor/ui";
import { DeleteVisitButton, EndVisitButton, FCQuickAssign } from "@/components/ops";
import { greeting, timeAgo } from "@/lib/utils";
import type { VisitLive } from "@/lib/api";
import { usePageTitle } from "@/hooks/use-page-title";

export default function TodayPage() {
  usePageTitle("Today");
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
          <h1 className="fp-display text-[32px] leading-none">{greeting()}, {first}</h1>
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
  first, visits, userId, creating, onWalkIn, nameOf,
}: {
  first: string;
  visits: VisitLive[];
  userId: string | null;
  creating: boolean;
  onWalkIn: () => void;
  nameOf: (v: VisitLive) => string;
}) {
  const router = useRouter();
  const { assignSalesperson, pushToast } = useStore();
  const [taking, setTaking] = useState(false);
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const OPEN = ["ARRIVED", "IDENTIFYING", "ASSIGNED", "ACTIVE"];
  const mine = visits.filter((v) => v.assignedSalespersonId && v.assignedSalespersonId === userId && OPEN.includes(v.status));
  const queue = visits.filter((v) => !v.assignedSalespersonId && OPEN.includes(v.status));
  const myDone = visits.filter((v) => v.assignedSalespersonId === userId && v.status === "COMPLETED").length;

  /* One ordered spine: whoever I'm serving comes first, then my assigned
     pending, then the unclaimed queue. Position 1 is the single thing to
     do next — everything else waits its turn. */
  const myLive = mine.filter((v) => v.status === "ACTIVE");
  const myPending = mine.filter((v) => v.status !== "ACTIVE");
  const ordered = [...myLive, ...myPending, ...queue];
  const hero = ordered[0] ?? null;
  const rest = ordered.slice(1);

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
        </div>
        <Btn tone="brand" onClick={onWalkIn} disabled={creating} className="min-h-12 w-full px-5 text-[15px] sm:w-auto sm:min-w-[180px]">
          {creating ? "Recording…" : "+ New walk-in"}
        </Btn>
      </div>

      <p className="fp-num mt-4 border-y border-[var(--fp-line)] py-3 text-[13.5px] text-[var(--fp-muted)]">
        {ordered.length === 0 ? (
          <>Floor is clear{myDone > 0 && <> · <strong className="font-semibold text-[var(--fp-ink)]">{myDone}</strong> done today</>}</>
        ) : (
          <><strong className="font-semibold text-[var(--fp-ink)]">{mine.length}</strong> yours · <strong className="font-semibold text-[var(--fp-ink)]">{queue.length}</strong> waiting for someone{myDone > 0 && <> · <strong className="font-semibold text-[var(--fp-ink)]">{myDone}</strong> done</>}</>
        )}
      </p>

      <div className="mt-6">
        {hero ? (
          <HeroNext
            v={hero}
            position={1}
            nameOf={nameOf}
            taking={taking}
            onTake={() => void takeCustomer(hero)}
          />
        ) : (
          <HeroEmpty creating={creating} onWalkIn={onWalkIn} />
        )}

        {rest.length > 0 && (
          <section aria-label="Waiting queue" className="mt-8">
            <h2 className="fp-kicker text-[var(--fp-faint)]">
              Waiting · {rest.length}
            </h2>
            <ol className="mt-2 divide-y divide-[var(--fp-line)] border-y border-[var(--fp-line)]">
              {rest.map((v, i) => {
                const s = nextStep(v);
                return (
                  <li key={v.id}>
                    <Link href={`/visits/${v.id}`} className="flex items-center gap-4 py-3.5 hover:bg-[var(--fp-ink-soft)]">
                      <span aria-hidden className="fp-num w-7 shrink-0 text-center text-[15px] font-semibold text-[var(--fp-faint)]">
                        {i + 2}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="fp-name block truncate text-[19px]">{nameOf(v)}</span>
                        <span className="fp-num mt-0.5 block text-[13px] text-[var(--fp-muted)]">{waitLine(v, s)}</span>
                      </span>
                      <span aria-hidden className="shrink-0 text-[15px] font-bold text-[var(--fp-faint)]">→</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}

/* Hero: position 1. Name big, state in plain words, exactly one big action.
   Ending a visit stays available but quiet — never equal to serving. */
function HeroNext({ v, position, nameOf, taking, onTake }: {
  v: VisitLive;
  position: number;
  nameOf: (v: VisitLive) => string;
  taking: boolean;
  onTake: () => void;
}) {
  const s = nextStep(v);
  const active = v.status === "ACTIVE";
  return (
    <section aria-label="Up next" className="border border-[var(--fp-line)] bg-[var(--fp-surface)] p-4 shadow-[var(--fp-shadow)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="fp-kicker text-[var(--fp-brand-deep)]">
          Up next · № {position}
        </p>
        <StatusMark value={active ? "active" : "waiting"} label={active ? "With you" : "Waiting"} />
      </div>
      <h2 className="fp-display mt-3 break-words text-[36px] leading-[1.02] sm:text-[44px]">{nameOf(v)}</h2>
      <p className="fp-num mt-2 text-[14px] text-[var(--fp-muted)]">{waitLine(v, s)}</p>
      <div className="mt-5">
        {s.kind === "take" ? (
          <Btn tone="brand" onClick={onTake} disabled={taking} className="min-h-13 w-full px-5 py-3.5 text-[16px] sm:w-auto sm:min-w-[240px]">
            {taking ? "Taking…" : s.cta}
          </Btn>
        ) : (
          <Link
            href={`/visits/${v.id}`}
            className={`inline-flex min-h-13 w-full items-center justify-center px-5 py-3.5 text-[16px] font-semibold text-white sm:w-auto sm:min-w-[240px] ${active ? "bg-[var(--fp-ink)] hover:bg-black" : "bg-[var(--fp-brand)] hover:bg-[var(--fp-brand-deep)]"}`}
          >
            {s.cta}
          </Link>
        )}
      </div>
      <div className="mt-3">
        <EndVisitButton visitId={v.id} name={nameOf(v)} className="min-h-11 w-full border-transparent bg-transparent px-0 text-[13px] underline underline-offset-2 sm:w-auto" />
      </div>
    </section>
  );
}


/* Nothing needs action: calm, not broken. Point at the one way work starts. */
function HeroEmpty({ creating, onWalkIn }: { creating: boolean; onWalkIn: () => void }) {
  return (
    <section aria-label="Floor clear" className="border border-dashed border-[var(--fp-line-strong)] bg-[var(--fp-surface)] p-5 sm:p-7">
      <p className="fp-kicker text-[var(--fp-faint)]">All clear</p>
      <h2 className="fp-display mt-2 text-[32px] leading-none">The floor is quiet.</h2>
      <p className="mt-2 max-w-[46ch] text-[14.5px] leading-relaxed text-[var(--fp-muted)]">
        No one is waiting on you. When someone walks in, record them here — the workspace takes it from there.
      </p>
      <Btn tone="brand" onClick={onWalkIn} disabled={creating} className="mt-5 min-h-12 w-full px-5 text-[15px] sm:w-auto">
        {creating ? "Recording…" : "+ New walk-in"}
      </Btn>
    </section>
  );
}

