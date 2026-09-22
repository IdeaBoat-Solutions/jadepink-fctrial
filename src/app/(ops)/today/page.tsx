"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Btn, EmptyNote, Metric, StatusMark } from "@/components/floor/ui";
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
                <div>
                  <p className="fp-name text-[22px] leading-none">{nameOf(v)}</p>
                  <p className="mt-1 text-[13px] text-[var(--fp-muted)]">Arrived {timeAgo(v.arrivedAt)} ago</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusMark value="waiting" label="Waiting" />
                  <Link href={`/visits/${v.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-[var(--fp-brand)] px-4 text-[14px] font-semibold text-white">Assign FC</Link>
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

function nextStep(v: VisitLive): { label: string; cta: string; mark: string } {
  if (!v.customerId) return { label: "Customer identification", cta: "Identify", mark: "waiting" };
  if (!v.assignedSalespersonId) return { label: "Waiting for an FC", cta: "Take customer", mark: "waiting" };
  if (v.status === "ACTIVE") return { label: "Active visit", cta: "Continue visit", mark: "active" };
  return { label: "Assigned — ready to start", cta: "Continue", mark: "selected" };
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
  const actionList = [...myPending, ...queue];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{greeting()}, {first}</h1>
          <p className="mt-1 text-[14px] text-[var(--fp-muted)]">Your floor terminal — arrivals, fittings, next steps.</p>
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
        <Link href="/customers" className="ml-auto font-semibold text-[var(--fp-muted)] hover:text-[var(--fp-ink)]">Find customer</Link>
      </div>

      <section className="mt-7" aria-label="Needs action">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">Needs action</h2>
        {actionList.length === 0 ? (
          <p className="mt-3 max-w-[52ch] text-[14.5px] leading-relaxed text-[var(--fp-muted)]">
            Nothing waiting. The next arrival starts with New walk-in.
          </p>
        ) : (
          <ul className="mt-2">
            {actionList.map((v) => {
              const s = nextStep(v);
              const theirs = !v.assignedSalespersonId;
              return (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fp-line)] py-3.5">
                  <div className="min-w-0">
                    <p className="fp-name text-[24px] leading-none">{nameOf(v)}</p>
                    <p className="mt-1.5 text-[13px] text-[var(--fp-muted)]">
                      {s.label}
                      <span className="mx-1.5 text-[var(--fp-line-strong)]">·</span>
                      Arrived {clockTime(v.arrivedAt)} ({timeAgo(v.arrivedAt)} ago)
                      {theirs && <><span className="mx-1.5 text-[var(--fp-line-strong)]">·</span>Unassigned</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusMark value={s.mark} label={s.label} />
                    <Link
                      href={`/visits/${v.id}`}
                      className={`inline-flex min-h-11 items-center rounded-lg px-4 text-[14px] font-semibold text-white ${theirs ? "bg-[var(--fp-brand)]" : "bg-[var(--fp-ink)]"}`}
                    >
                      {s.cta}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-7" aria-label="With me now">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">With me now</h2>
        {myLive.length === 0 ? (
          <p className="mt-3 max-w-[52ch] text-[14.5px] leading-relaxed text-[var(--fp-muted)]">
            No fitting running. Take the next arrival above, or start a walk-in.
          </p>
        ) : (
          <ul className="mt-2">
            {myLive.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fp-line)] py-3.5">
                <div className="min-w-0">
                  <p className="fp-name text-[24px] leading-none">{nameOf(v)}</p>
                  <p className="fp-num mt-1.5 text-[13px] text-[var(--fp-muted)]">
                    Active {timeAgo(v.startedAt || v.arrivedAt)}
                  </p>
                </div>
                <Link href={`/visits/${v.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-[var(--fp-ink)] px-4 text-[14px] font-semibold text-white">
                  Continue visit
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
