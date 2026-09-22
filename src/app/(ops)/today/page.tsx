"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Btn, EmptyNote, Metric, StatusMark } from "@/components/floor/ui";
import { greeting, timeAgo } from "@/lib/utils";

export default function TodayPage() {
  const { user, visits, todayCounts, activeVisits, awaitingAssignment, createWalkIn, pushToast, salespeople } = useStore();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const isManager = user?.role === "manager";
  const first = user?.name?.split(" ")[0] || "there";

  const mine = visits.filter((v) => v.assignedSalespersonId === user?.id);
  const myActive = mine.filter((v) => v.status === "ACTIVE" || v.status === "ASSIGNED" || v.status === "IDENTIFYING" || v.status === "ARRIVED");
  const open = isManager ? activeVisits : myActive;

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

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{greeting()}, {first}</h1>
          <p className="mt-1 text-[14px] text-[var(--fp-muted)]">
            {isManager ? "Today's store activity" : "Your customers on the floor"}
          </p>
        </div>
        {!isManager && (
          <Btn tone="brand" onClick={() => void newWalkIn()} disabled={creating} className="min-w-[180px] min-h-12 text-[15px]">
            {creating ? "Recording…" : "New walk-in"}
          </Btn>
        )}
        {isManager && (
          <Btn tone="brand" className="min-w-[180px] min-h-12 text-[15px]" onClick={() => router.push("/floor")}>
            Open live floor
          </Btn>
        )}
      </div>

      <dl className="mt-6 grid grid-cols-2 divide-x divide-[var(--fp-line)] border-y border-[var(--fp-line)] sm:grid-cols-4">
        {isManager ? (
          <>
            <Metric value={todayCounts.walkIns} label="Store walk-ins" />
            <Metric value={todayCounts.active} label="Active visits" />
            <Metric value={visits.filter((v) => v.status === "COMPLETED").length} label="Completed" />
            <Metric value={todayCounts.awaiting} label="Awaiting assignment" warn={todayCounts.awaiting > 0} />
          </>
        ) : (
          <>
            <Metric value={mine.length} label="My walk-ins" />
            <Metric value={mine.filter((v) => v.status === "ACTIVE").length} label="My active visits" />
            <Metric value={mine.filter((v) => v.status === "COMPLETED").length} label="My completed" />
            <Metric value={awaitingAssignment.length} label="Waiting in store" warn={awaitingAssignment.length > 0} />
          </>
        )}
      </dl>

      <section className="mt-8" aria-label={isManager ? "Store activity" : "My active customers"}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">
            {isManager ? "Needs attention" : "My active customers"}
          </h2>
          {isManager && <Link href="/floor" className="text-[13.5px] font-semibold text-[var(--fp-brand)]">All active visits</Link>}
        </div>

        {isManager && awaitingAssignment.length > 0 && (
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

        {!isManager && (
          open.length === 0 ? (
            <EmptyNote title="No customers are currently with you." body="When someone walks in, record the arrival. Identification is the next step." action={<Btn tone="brand" onClick={() => void newWalkIn()}>New walk-in</Btn>} />
          ) : (
            <ul className="mt-2">
              {open.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fp-line)] py-3.5">
                  <div className="min-w-0">
                    <p className="fp-name text-[24px] leading-none">{nameOf(v)}</p>
                    <p className="mt-1.5 text-[13.5px] text-[var(--fp-muted)]">
                      {v.status === "ACTIVE" ? "Active visit" : v.customerId ? "Assigned" : "Customer identification"}
                      <span className="mx-1.5 text-[var(--fp-line-strong)]">·</span>
                      {timeAgo(v.startedAt || v.arrivedAt)} ago
                    </p>
                  </div>
                  <Link href={`/visits/${v.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-[var(--fp-ink)] px-4 text-[14px] font-semibold text-white">
                    Continue visit
                  </Link>
                </li>
              ))}
            </ul>
          )
        )}

        {isManager && awaitingAssignment.length === 0 && activeVisits.length === 0 && (
          <EmptyNote title="No customers are currently active." body="The floor is quiet. New walk-ins will appear here the moment they are recorded." />
        )}

        {isManager && activeVisits.length > 0 && (
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
