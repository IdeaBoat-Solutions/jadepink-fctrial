"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Panel } from "@/components/ui";
import { CreateCustomerCard, CustomerSnapshot, HistoryLayers } from "@/components/ops";
import type { CustomerSnapshotLive } from "@/lib/api";

/* Customer profile.
   The client cache only holds customers seen in today's visits, so this screen
   resolves the record from the database before deciding anything. A missing
   record shows the create option — never a blank page. */

type State =
  | { status: "checking" }
  | { status: "found"; customer: CustomerSnapshotLive }
  | { status: "missing" };

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getCustomer, fetchCustomer, visits } = useStore();
  const cached = getCustomer(id);

  const [state, setState] = useState<State>(cached ? { status: "found", customer: cached } : { status: "checking" });

  // Resolve from the database when the cache can't answer (direct URL, reload,
  // history link). setState happens after the await, never in the effect body.
  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    void (async () => {
      const c = await fetchCustomer(id);
      if (cancelled) return;
      setState(c ? { status: "found", customer: c } : { status: "missing" });
    })();
    return () => { cancelled = true; };
  }, [id, cached, fetchCustomer]);

  if (state.status === "checking") {
    return (
      <div className="staff-page mx-auto w-full max-w-3xl" aria-busy="true" aria-label="Loading customer">
        <div className="skeleton-soft h-5 w-28 rounded-lg" />
        <div className="skeleton-soft h-[180px] rounded-2xl" />
        <div className="skeleton-soft h-[140px] rounded-2xl" style={{ animationDelay: "120ms" }} />
        <p className="sr-only">Loading customer record…</p>
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="staff-page mx-auto w-full max-w-3xl">
        <Link href="/customers" className="group inline-flex min-h-[36px] w-fit items-center gap-1 rounded-lg px-1 text-[13.5px] font-semibold text-[#78716c] transition-colors hover:bg-[#f3eeea] hover:text-[#1c1917]"><span aria-hidden className="transition-transform duration-150 group-hover:-translate-x-0.5">←</span> Customers</Link>

        <CreateCustomerCard
          autoFocus
          title="This customer record doesn't exist."
          body="The link may be out of date, or the record was removed. Create it here and you'll land straight on the new profile."
          onCreated={(c) => router.replace(`/customers/${c.id}`)}
        />

        <Panel className="p-5 sm:p-6">
          <h2 className="staff-h2">Looking for someone already in store?</h2>
          <p className="staff-sub">Search the directory by mobile or name — only matching records load.</p>
          <Link href="/customers" className="mt-3 inline-flex min-h-[48px] items-center gap-1 rounded-xl border border-[#d6c9bb] px-4 text-[14px] font-semibold transition-all duration-150 hover:-translate-y-px hover:border-[#1c1917] hover:bg-[#faf8f6] active:translate-y-0">Search the directory →</Link>
        </Panel>
      </div>
    );
  }

  const customer = state.customer;
  const liveVisit = visits.find((v) => v.customerId === customer.id && ["ACTIVE", "ASSIGNED", "IDENTIFYING"].includes(v.status));

  return (
    <div className="staff-page mx-auto w-full max-w-3xl">
      <Link href="/customers" className="group inline-flex min-h-[36px] w-fit items-center gap-1 rounded-lg px-1 text-[13.5px] font-semibold text-[#78716c] transition-colors hover:bg-[#f3eeea] hover:text-[#1c1917]"><span aria-hidden className="transition-transform duration-150 group-hover:-translate-x-0.5">←</span> Customers</Link>

      {liveVisit && (
        <Link href={`/visits/${liveVisit.id}`} className="group flex items-center justify-between gap-3 rounded-2xl bg-[#1c1917] px-4 py-3.5 text-[14px] font-semibold text-white shadow-[0_12px_28px_-12px_rgba(28,25,23,0.7)] transition-all duration-150 hover:-translate-y-px hover:bg-black active:translate-y-0">
          <span className="flex items-center gap-2.5"><span aria-hidden className="live-dot inline-block size-2 rounded-full bg-emerald-300 text-emerald-300" /> In store now — open active visit</span>
          <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-1">→</span>
        </Link>
      )}

      <Panel className="p-5 sm:p-6">
        <CustomerSnapshot customer={customer} />
      </Panel>

      <Panel className="p-5 sm:p-6">
        <h2 className="staff-h2">Visit history</h2>
        <p className="staff-sub">Who served them · what they tried · what they bought. Most recent first.</p>
        <div className="mt-3"><HistoryLayers customerId={customer.id} /></div>
      </Panel>
    </div>
  );
}
