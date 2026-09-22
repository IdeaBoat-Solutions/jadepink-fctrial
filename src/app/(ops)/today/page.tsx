"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { greeting } from "@/lib/utils";
import { Panel, SectionTitle, EmptyState, StatusBadge } from "@/components/ui";
import { ActiveVisitRow } from "@/components/ops";

export default function TodayPage() {
  const { user, todayCounts, activeVisits, awaitingAssignment, visits, pushToast, createWalkIn } = useStore();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const newWalkIn = async () => {
    if (creating) return;
    setCreating(true);
    // §7: instant acknowledgement, then navigation once the visit exists.
    pushToast("Recording walk-in…", "One moment.");
    const v = await createWalkIn();
    setCreating(false);
    if (!v) return;
    pushToast("Walk-in recorded", "Now identify the customer.");
    router.push(`/walk-in?visit=${v.id}`);
  };

  const recent = [...visits].sort((a, b) => +new Date(b.arrivedAt) - +new Date(a.arrivedAt)).slice(0, 5);

  return (
    <div className="staff-page">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="staff-kicker">Today · JadePink Ahmedabad</p>
          <h1 className="staff-title mt-1">
            {greeting()}, {user?.name}
          </h1>
          <p className="staff-sub">Today&apos;s store activity — walk-ins, active visits, who needs an FC.</p>
        </div>
        <button
          onClick={newWalkIn}
          disabled={creating}
          className="btn-sheen group inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#b4234d] px-6 text-[16px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(180,35,77,0.6)] transition-all duration-150 hover:-translate-y-px hover:bg-[#93183d] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto"
        >
          <span aria-hidden className="grid size-6 place-items-center rounded-full bg-white/20 text-[18px] leading-none transition-transform duration-200 group-hover:scale-110 group-hover:rotate-90">{creating ? "…" : "+"}</span> {creating ? "Recording…" : "New walk-in"}
        </button>
      </div>

      {/* Operational counts — not management analytics */}
      <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4" aria-label="Today's counts">
        {[
          { label: "Walk-ins", value: todayCounts.walkIns },
          { label: "Active visits", value: todayCounts.active },
          { label: "Completed", value: todayCounts.completed },
          { label: "Awaiting assignment", value: todayCounts.awaiting, warn: todayCounts.awaiting > 0 },
        ].map((s) => (
          <div key={s.label} className={`pressable rounded-2xl border bg-white px-4 py-3.5 ${s.warn ? "border-[#f0d48a] bg-[#fffdf5]" : "border-[#e8dfd6]"}`}>
            <dd key={s.value} className="count-pop tnum text-[28px] font-semibold leading-none tracking-tight text-[#1c1917]">{s.value}</dd>
            <dt className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-[#78716c]">
              {s.warn && <span aria-hidden className="live-dot inline-block size-1.5 rounded-full bg-[#9a5b00] text-[#9a5b00]" />}
              {s.label}
            </dt>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="p-5 sm:p-6">
            <SectionTitle kicker="Needs attention" title="Active customers" aside={<Link href="/floor" className="group inline-flex min-h-[36px] items-center gap-1 text-[13.5px] font-semibold text-[#b4234d] hover:underline">Open live floor <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">→</span></Link>} />
            <div className="mt-4 flex flex-col gap-2">
              {activeVisits.length ? activeVisits.map((v) => <ActiveVisitRow key={v.id} visit={v} />) : (
                <EmptyState title="No active visits right now." body="New customers will appear here when their visit starts. Use New walk-in the moment someone arrives." />
              )}
            </div>
          </Panel>

          {awaitingAssignment.length > 0 && (
            <Panel className="border-[#f0d48a] bg-[#fffdf5] p-5 sm:p-6">
              <SectionTitle kicker="Waiting" title={`${awaitingAssignment.length} awaiting assignment`} />
              <div className="mt-4 flex flex-col gap-2">
                {awaitingAssignment.map((v) => <ActiveVisitRow key={v.id} visit={v} />)}
              </div>
            </Panel>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="p-5 sm:p-6">
            <SectionTitle kicker="Timeline" title="Recent activity" />
            <div className="mt-4 flex flex-col">
              {recent.length ? (
                recent.map((v, i) => (
                  <Link key={v.id} href={`/visits/${v.id}`} className="pressable group relative flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-[#faf8f6]">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span aria-hidden className="flex flex-col items-center">
                        <span className="size-2 rounded-full border-2 border-[#b4234d] bg-white" />
                        {i < recent.length - 1 && <span className="mt-1 h-4 w-px bg-[#e8dfd6]" />}
                      </span>
                      <span className="min-w-0 truncate text-[13.5px] font-medium text-[#1c1917] group-hover:underline group-hover:underline-offset-2">{v.customerName || "Identifying…"}</span>
                    </span>
                    <StatusBadge value={v.status} />
                  </Link>
                ))
              ) : (
                <p className="rounded-xl bg-[#faf8f6] px-4 py-6 text-center text-[14px] text-[#78716c]">Nothing yet today — the first walk-in starts the story.</p>
              )}
            </div>
          </Panel>

          <Panel className="relative overflow-hidden bg-[#1c1917] p-5 text-white sm:p-6">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[#b4234d]/25 blur-3xl" />
            <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-white/50">How today flows</p>
            <ol className="mt-3 flex flex-col gap-2 text-[13.5px] leading-relaxed text-white/85">
              {[["1", "New walk-in → arrival recorded"], ["2", "Find customer by mobile"], ["3", "Assign FC → start visit"], ["4", "Hand off to Stage 3 on the floor"]].map(([n, t]) => (
                <li key={n} className="flex items-baseline gap-2.5"><strong className="tnum grid size-5 shrink-0 translate-y-px place-items-center rounded-full bg-white/10 text-[11px] font-bold text-white">{n}</strong>{t}</li>
              ))}
            </ol>
            <button onClick={newWalkIn} disabled={creating} className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-[14px] font-bold text-[#1c1917] transition-all duration-150 hover:-translate-y-px hover:bg-[#f3eeea] active:translate-y-0 active:scale-[0.98] disabled:opacity-60">
              {creating ? "Recording…" : "Start a walk-in now →"}
            </button>
          </Panel>
        </div>
      </div>
    </div>
  );
}
