"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { greeting } from "@/lib/utils";
import { Panel, SectionTitle, EmptyState, StatusBadge } from "@/components/ui";
import { ActiveVisitRow } from "@/components/ops";

/* Today — floor command. Dark command band (who, when, what's live, the one
   action), a unified stat strip, then the action queue first: waiting for an
   FC above on-the-floor. Timeline + flow guide ride the rail. */

function useStoreClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);
  const day = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
  const time = now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const parts = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "numeric", hour12: false, timeZone: "Asia/Kolkata" })
    .formatToParts(now)
    .reduce<Record<string, number>>((acc, p) => (p.type === "hour" || p.type === "minute" ? { ...acc, [p.type]: Number(p.value) } : acc), {});
  const mins = (parts.hour ?? 0) * 60 + (parts.minute ?? 0);
  const open = mins >= 630 && mins < 1200; // 10:30 AM – 8:00 PM IST
  return { day, time, open };
}

const FLOW = ["New walk-in records the arrival", "Find them by mobile", "Assign FC, start the visit", "Continue to the floor trial"];

export default function TodayPage() {
  const { user, todayCounts, activeVisits, awaitingAssignment, visits, pushToast, createWalkIn } = useStore();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const { day, time, open } = useStoreClock();

  const newWalkIn = async () => {
    if (creating) return;
    setCreating(true);
    // §7: instant acknowledgement, then navigation once the visit exists.
    pushToast("Recording walk-in…", "One moment.");
    const v = await createWalkIn();
    setCreating(false);
    if (!v) {
      pushToast("Could not record walk-in", "Check your connection and try again.");
      return;
    }
    pushToast("Walk-in recorded", "Now identify the customer.");
    router.push(`/walk-in?visit=${v.id}`);
  };

  const recent = [...visits].sort((a, b) => +new Date(b.arrivedAt) - +new Date(a.arrivedAt)).slice(0, 5);
  const liveLine =
    todayCounts.active === 0 && todayCounts.awaiting === 0
      ? "Floor is quiet — the first arrival starts the day."
      : [
          todayCounts.active > 0 ? `${todayCounts.active} on the floor` : null,
          todayCounts.awaiting > 0 ? `${todayCounts.awaiting} waiting for an FC` : null,
        ]
          .filter(Boolean)
          .join(" · ") + ".";

  const stats = [
    { label: "Walk-ins", value: todayCounts.walkIns },
    { label: "On the floor", value: todayCounts.active },
    { label: "Completed", value: todayCounts.completed },
    { label: "Waiting for FC", value: todayCounts.awaiting, warn: todayCounts.awaiting > 0 },
  ];

  return (
    <div className="staff-page">
      {/* Command band */}
      <section aria-label="Today overview" className="relative overflow-hidden rounded-3xl bg-[#1c1917] px-5 py-6 text-white shadow-[0_24px_48px_-24px_rgba(28,25,23,0.7)] sm:px-8 sm:py-8">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[#b4234d]/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white/55">
              <span aria-hidden className={`inline-block size-1.5 rounded-full ${open ? "live-dot bg-[#4ade80] text-[#4ade80]" : "bg-white/30"}`} />
              {day} · {time} · {open ? "Open now" : "Closed"} · JadePink Ahmedabad
            </p>
            <h1 className="mt-2 text-[30px] font-semibold leading-[1.05] tracking-tight text-balance sm:text-[38px]">
              {greeting()}, {user?.name}
            </h1>
            <p className="mt-2 max-w-[52ch] text-[14.5px] leading-relaxed text-white/70">{liveLine}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[240px]">
            <button
              onClick={newWalkIn}
              disabled={creating}
              className="group inline-flex min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-white px-6 text-[16px] font-bold text-[#1c1917] transition-all duration-150 hover:-translate-y-px hover:bg-[#f3eeea] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              <span aria-hidden className="grid size-6 place-items-center rounded-full bg-[#1c1917] text-[18px] leading-none text-white transition-transform duration-200 group-hover:scale-110 group-hover:rotate-90">{creating ? "…" : "+"}</span>
              {creating ? "Recording…" : "New walk-in"}
            </button>
            <p className="text-center text-[12px] text-white/50 sm:text-right">Open daily 10:30 AM – 8:00 PM</p>
          </div>
        </div>
      </section>

      {/* Stat strip — one panel, four cells */}
      <dl aria-label="Today's counts" className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[#e8dfd6] bg-white lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`px-5 py-4 ${i > 0 ? "border-l border-[#e8dfd6]" : ""} ${i >= 2 ? "max-lg:border-t max-lg:border-[#e8dfd6]" : ""} ${i === 2 ? "max-lg:border-l-0" : ""} ${s.warn ? "bg-[#fffdf5]" : ""}`}
          >
            <dd key={s.value} className="count-pop tnum text-[30px] font-semibold leading-none tracking-tight text-[#1c1917]">{s.value}</dd>
            <dt className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-[#78716c]">
              {s.warn && <span aria-hidden className="live-dot inline-block size-1.5 rounded-full bg-[#9a5b00] text-[#9a5b00]" />}
              {s.label}
            </dt>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Action queue first */}
          <Panel className={`p-5 sm:p-6 ${awaitingAssignment.length > 0 ? "border-[#f0d48a] bg-[#fffdf5]" : ""}`}>
            <SectionTitle
              kicker="Needs an FC"
              title={awaitingAssignment.length > 0 ? `${awaitingAssignment.length} waiting` : "Queue clear"}
              aside={<Link href="/floor" className="group inline-flex min-h-[36px] items-center gap-1 text-[13.5px] font-semibold text-[#b4234d] hover:underline">Live floor <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">→</span></Link>}
            />
            <div className="mt-4 flex flex-col gap-2">
              {awaitingAssignment.length ? (
                awaitingAssignment.map((v) => <ActiveVisitRow key={v.id} visit={v} />)
              ) : (
                <EmptyState title="Everyone has an FC." body="New arrivals that need assignment will land here first." />
              )}
            </div>
          </Panel>

          <Panel className="p-5 sm:p-6">
            <SectionTitle kicker="Serving now" title="On the floor" />
            <div className="mt-4 flex flex-col gap-2">
              {activeVisits.length ? (
                activeVisits.map((v) => <ActiveVisitRow key={v.id} visit={v} />)
              ) : (
                <EmptyState title="Floor is empty." body="Visits appear here the moment an FC starts one." />
              )}
            </div>
          </Panel>
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

          <Panel className="p-5 sm:p-6">
            <SectionTitle kicker="Flow" title="How today works" />
            <ol className="mt-4 flex flex-col gap-2.5">
              {FLOW.map((t, i) => (
                <li key={t} className="flex items-baseline gap-2.5 text-[13.5px] leading-relaxed text-[#57534e]">
                  <strong className="tnum grid size-5 shrink-0 translate-y-px place-items-center rounded-full bg-[#f3eeea] text-[11px] font-bold text-[#1c1917]">{i + 1}</strong>
                  {t}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
