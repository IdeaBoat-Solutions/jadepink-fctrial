"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { AccessNote, Btn, EmptyNote, ErrorNote, StatusMark } from "@/components/floor/ui";
import { canViewLiveFloor } from "@/lib/policy";
import { listActiveVisits, listStaffRoster, type StaffRosterRow, type VisitLive } from "@/lib/api";
import { clockTime, timeAgo } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";

function stateLabel(v: VisitLive): { key: string; label: string } {
  if (v.status === "COMPLETED") return { key: "completed", label: "Completed" };
  if (v.status === "ACTIVE") return { key: "active", label: "Active visit" };
  if (v.status === "ASSIGNED") return { key: "selected", label: "Assigned" };
  return { key: "waiting", label: "Identifying" };
}

export default function TeamPage() {
  usePageTitle("Sales team");
  const { user, salespeople, profile } = useStore();
  const router = useRouter();
  const [todayList, setTodayList] = useState<VisitLive[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [roster, setRoster] = useState<StaffRosterRow[] | null>(null);
  const [rosterFailed, setRosterFailed] = useState(false);

  const isManager = !!user && canViewLiveFloor(user.role);

  useEffect(() => {
    const storeId = profile?.storeId;
    if (!storeId) return;
    let cancelled = false;
    void (async () => {
      const r = await listActiveVisits(storeId);
      if (cancelled) return;
      if (r.ok) setTodayList(r.data);
      else setFailed(true);
    })();
    return () => { cancelled = true; };
  }, [profile?.storeId]);

  // Full floor team (FCs + managers, with role labels) — manager view only.
  useEffect(() => {
    if (!isManager) return;
    let cancelled = false;
    void (async () => {
      const r = await listStaffRoster();
      if (cancelled) return;
      if (r.ok) setRoster(r.data);
      else setRosterFailed(true);
    })();
    return () => { cancelled = true; };
  }, [isManager]);

  if (user && !canViewLiveFloor(user.role)) {
    return (
      <AccessNote
        title="Sales team is a manager view."
        body="You do not need the roster to serve the customer in front of you."
        action={<Btn tone="brand" onClick={() => router.push("/today")}>Back to my work</Btn>}
      />
    );
  }

  const forFc = (id: string) => (todayList ?? []).filter((v) => v.assignedSalespersonId === id);
  const liveFor = (id: string) => forFc(id).filter((v) => v.status === "ACTIVE" || v.status === "ASSIGNED");
  const doneFor = (id: string) => forFc(id).filter((v) => v.status === "COMPLETED");

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-tight">Sales team</h1>
      <p className="mt-1 text-[14px] text-[var(--fp-muted)]">Who is with whom right now, and how many customers each FC has attended today.</p>

      {failed && (
        <div className="mt-4">
          <ErrorNote
            title="Could not load today's attendance."
            body="Availability below may be stale. Check your connection and reload."
            action={<Btn tone="line" onClick={() => window.location.reload()}>Reload</Btn>}
          />
        </div>
      )}

      {salespeople.length === 0 ? (
        <EmptyNote title="No salespeople are on this store yet." body="Activate staff profiles, then they will appear here with their live load." />
      ) : (
        <ul className="mt-5">
          {salespeople.map((sp) => {
            const mine = forFc(sp.id);
            const live = liveFor(sp.id);
            const done = doneFor(sp.id);
            const state = !sp.active ? "offline" : live.length > 0 ? "busy" : "available";
            const expanded = open === sp.id;
            return (
              <li key={sp.id} className="border-b border-[var(--fp-line)] py-4">
                <button
                  onClick={() => setOpen(expanded ? null : sp.id)}
                  aria-expanded={expanded}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left"
                >
                  <span>
                    <span className="block text-[17px] font-semibold">{sp.name}</span>
                    <span className="fp-num mt-0.5 block text-[13px] text-[var(--fp-muted)]">
                      {todayList === null ? "Loading today…" : `${mine.length} attended today · ${live.length} with them now · ${done.length} completed`}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusMark value={state} />
                    <span aria-hidden className="text-[var(--fp-faint)]">{expanded ? "▴" : "▾"}</span>
                  </span>
                </button>

                {expanded && (
                  <div className="fp-rise mt-3 border-t border-[var(--fp-line)] pt-3">
                    {todayList === null && <div className="fp-skel h-12" aria-busy="true" aria-label="Loading attendance" />}
                    {todayList !== null && mine.length === 0 && (
                      <p className="py-2 text-[14px] text-[var(--fp-muted)]">No customers attended yet today. They are free for the next arrival.</p>
                    )}
                    {live.length > 0 && (
                      <>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">Attending now</p>
                        <ul>
                          {live.map((v) => {
                            const s = stateLabel(v);
                            return (
                              <li key={v.id}>
                                <Link href={`/visits/${v.id}`} className="flex items-center justify-between gap-3 py-2.5">
                                  <span>
                                    <span className="block text-[15px] font-semibold">{v.customerName || "Unidentified customer"}</span>
                                    <span className="text-[12.5px] text-[var(--fp-muted)]">
                                      {v.status === "ACTIVE" ? `Active ${timeAgo(v.startedAt || v.arrivedAt)}` : `Assigned · arrived ${clockTime(v.arrivedAt)}`}
                                    </span>
                                  </span>
                                  <StatusMark value={s.key} label={s.label} />
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                    {done.length > 0 && (
                      <>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">Completed today</p>
                        <ul>
                          {done.map((v) => (
                            <li key={v.id}>
                              <Link href={`/visits/${v.id}`} className="flex items-center justify-between gap-3 py-2">
                                <span className="text-[14.5px]">{v.customerName || "Customer"}</span>
                                <span className="fp-num text-[12.5px] text-[var(--fp-muted)]">{clockTime(v.completedAt || v.arrivedAt)}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {live.length > 0 && (
                      <p className="mt-2 text-[13px] text-[var(--fp-muted)]">Open a visit above to view products, timeline — or reassign the FC.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Full floor team from GET /api/staff — FCs and managers with role labels. */}
      {isManager && (
        <section className="mt-8" aria-label="Full floor team">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">Full floor team</h2>
          {rosterFailed && (
            <div className="mt-3">
              <ErrorNote
                title="Could not load the full roster."
                body="The FC list above is still live. Reload to try the roster again."
                action={<Btn tone="line" onClick={() => window.location.reload()}>Reload</Btn>}
              />
            </div>
          )}
          {roster === null && !rosterFailed && (
            <div className="fp-skel mt-3 h-12" aria-busy="true" aria-label="Loading roster" />
          )}
          {roster !== null && roster.length === 0 && (
            <div className="mt-3">
              <EmptyNote title="No staff on the roster yet." body="Active staff profiles appear here as soon as they are created." />
            </div>
          )}
          {roster !== null && roster.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {roster.map((r) => (
                <li
                  key={r.id}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[var(--fp-line)] bg-[var(--fp-surface)] px-3.5 text-[14px]"
                >
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-[12px] text-[var(--fp-muted)]">{r.role_label || r.role}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
