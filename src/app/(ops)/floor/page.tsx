"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { AccessNote, Btn, EmptyNote } from "@/components/floor/ui";
import { DeleteVisitButton, FCQuickAssign } from "@/components/ops";
import { timeAgo } from "@/lib/utils";
import { listFloorVisits, type FloorSummary } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { canViewLiveFloor } from "@/lib/policy";

export default function FloorPage() {
  const { salespeople, profile, user, activeVisits, awaitingAssignment, createWalkIn, pushToast } = useStore();
  const router = useRouter();
  const [summaries, setSummaries] = useState<Map<string, FloorSummary>>(new Map());
  const [creating, setCreating] = useState(false);
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
      for (const row of r.data) {
        next.set(row.visit.id, row.summary);
      }
      setSummaries(next);
    } catch { /* keep last numbers */ }
  }, [storeId]);

  useEffect(() => {
    const t0 = window.setTimeout(() => void refresh(), 0);
    const t = window.setInterval(() => void refresh(), 15000);
    return () => { window.clearTimeout(t0); window.clearInterval(t); };
  }, [refresh]);

  useEffect(() => {
    if (!storeId || !isSupabaseConfigured()) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 400);
    };
    /* §31: narrow what wakes this board. `visits` carries store_id, so its
       channel is filtered to this store — other stores' assigns/completes no
       longer trigger a refetch here. `visit_products` has no store_id column
       to filter on, so it stays broad; RLS still scopes the /floor refetch to
       this store, so a cross-store product change only costs one wasted,
       debounced refetch (never a data leak). Denormalizing store_id onto the
       hot visit_products table to filter it too isn't worth the write cost. */
    const channel = supabase
      .channel(`floor-os:${storeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "visit_products" }, fire)
      .on("postgres_changes", { event: "*", schema: "public", table: "visits", filter: `store_id=eq.${storeId}` }, fire)
      .subscribe();
    return () => { if (timer) clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [storeId, refresh]);

  if (user && !canViewLiveFloor(user.role)) {
    return (
      <AccessNote
        title="Live floor is a manager view."
        body="Your work is the customer in front of you. Open My visits to continue a fitting."
        action={<Btn tone="brand" onClick={() => router.push("/today")}>Back to my work</Btn>}
      />
    );
  }

  const fcOf = (id: string | null, fallback?: string | null) => salespeople.find((s) => s.id === id)?.name || fallback || "Unassigned";
  const waiting = awaitingAssignment;
  const active = activeVisits.filter((v) => v.status === "ACTIVE" || (v.status === "ASSIGNED" && v.assignedSalespersonId));

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-2 text-[13px] text-[var(--fp-muted)]">
        <Link href="/today" className="font-semibold text-[var(--fp-brand)]">Today</Link>
        <span aria-hidden className="mx-1.5">/</span>
        <span aria-current="page" className="text-[var(--fp-ink)]">Live floor</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Live floor</h1>
          <p className="mt-1 text-[14px] text-[var(--fp-muted)]">
            <span className="fp-num font-semibold text-[var(--fp-ink)]">{active.length}</span> active visits
            <span className="mx-2 text-[var(--fp-line-strong)]">·</span>
            <span className="fp-num font-semibold text-[var(--fp-ink)]">{waiting.length}</span> waiting for assignment
          </p>
          <p className="mt-1 text-[13px] text-[var(--fp-muted)]">Assign waiting customers, then open the visit — no need to remember who is where.</p>
        </div>
        <Btn tone="brand" onClick={() => void newWalkIn()} disabled={creating}>
          {creating ? "Recording…" : "+ New walk-in"}
        </Btn>
      </div>

      {waiting.length > 0 && (
        <section className="mt-6" aria-label="Waiting for assignment">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-wait)]">Waiting</h2>
          <ul>
            {waiting.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fp-line)] py-3.5">
                <div className="min-w-0">
                  <p className="fp-name text-[24px] leading-none">{v.customerName || "Unidentified"}</p>
                  <p className="mt-1 text-[13px] text-[var(--fp-muted)]">Arrived {timeAgo(v.arrivedAt)} ago</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {v.customerId ? (
                    <div className="w-full min-w-0 sm:w-auto sm:min-w-[220px]"><FCQuickAssign visitId={v.id} currentSpId={v.assignedSalespersonId ?? null} /></div>
                  ) : (
                    <Link href={`/visits/${v.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-[var(--fp-brand)] px-4 text-[14px] font-semibold text-white">Identify</Link>
                  )}
                  <DeleteVisitButton visitId={v.id} name={v.customerName || "Unidentified"} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6" aria-label="Active visits">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">Active</h2>
        {active.length === 0 ? (
          <EmptyNote title="No customers are currently active." body="Assigned visits appear here with product counts as soon as a salesperson starts the fitting." />
        ) : (
          <ul>
            {active.map((v) => {
              const s = summaries.get(v.id);
              const trials = s ? s.trialInProgress + s.trialCompleted : null;
              return (
                <li key={v.id} className="grid gap-3 border-b border-[var(--fp-line)] py-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-center">
                  <div>
                    <p className="fp-name text-[24px] leading-none">{v.customerName || "Customer"}</p>
                    <p className="mt-1.5 text-[13.5px] text-[var(--fp-muted)]">
                      FC {fcOf(v.assignedSalespersonId, v.fcName)}
                      <span className="mx-1.5">·</span>
                      Active {timeAgo(v.startedAt || v.arrivedAt)}
                    </p>
                  </div>
                  <p className="fp-num text-[13.5px] text-[var(--fp-muted)]">
                    {s ? (
                      <>
                        <span className="font-semibold text-[var(--fp-ink)]">{s.selected}</span> selected
                        <span className="mx-1.5 text-[var(--fp-line-strong)]">·</span>
                        <span className="font-semibold text-[var(--fp-ink)]">{trials}</span> trials
                        <span className="mx-1.5 text-[var(--fp-line-strong)]">·</span>
                        <span className="font-semibold text-[var(--fp-ink)]">{s.liked}</span> liked
                        <span className="mx-1.5 text-[var(--fp-line-strong)]">·</span>
                        <span className="font-semibold text-[var(--fp-ink)]">{s.dropped}</span> dropped
                        {s.purchased > 0 && (
                          <>
                            <span className="mx-1.5 text-[var(--fp-line-strong)]">·</span>
                            <span className="font-semibold text-[var(--fp-ok)]">{s.purchased} billed</span>
                          </>
                        )}
                      </>
                    ) : (
                      "Counts updating"
                    )}
                  </p>
                  <Link href={`/visits/${v.id}`} className="text-[14px] font-semibold text-[var(--fp-brand)]">View visit</Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </div>
  );
}
