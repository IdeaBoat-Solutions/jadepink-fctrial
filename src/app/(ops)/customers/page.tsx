"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Panel, TextInput, SecondaryButton } from "@/components/ui";
import { CreateCustomerCard, CustomerSnapshot } from "@/components/ops";
import { normalizeMobile } from "@/lib/domain";
import { paginate, DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { PaginationControls, usePageParam } from "@/components/pagination";
import type { CustomerSnapshotLive } from "@/lib/api";

/* Customer lookup (§12, §35): query the API for matching records only —
   never the whole database. A miss is never a dead end: the shared
   create-record panel takes over, prefilled with whatever was typed. */

function CustomersInner() {
  const { customers, searchCustomer, visits } = useStore();
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<CustomerSnapshotLive | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [created, setCreated] = useState<CustomerSnapshotLive | null>(null);
  const { page, setPage } = usePageParam(q);

  // A typed 10-digit number is a mobile, not a name — prefill accordingly.
  const digits = normalizeMobile(q);
  const queryDigits = digits.length >= 10 ? digits : "";
  const hasQuery = q.trim().length >= 3;

  // Debounced server search; falls back to the locally known set.
  // All setState happens inside the timer callback (React Compiler rule).
  useEffect(() => {
    const query = q.trim();
    let cancelled = false;
    const t = window.setTimeout(async () => {
      if (query.length < 3) { setRemote(null); setSearching(false); setSearched(false); return; }
      setSearching(true);
      const c = await searchCustomer(q);
      if (!cancelled) { setRemote(c); setSearching(false); setSearched(true); }
    }, 220);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [q, searchCustomer]);

  const results: CustomerSnapshotLive[] = useMemo(() => {
    if (q.trim().length >= 3) return remote ? [remote] : [];
    return customers;
  }, [q, remote, customers]);

  const paged = paginate(results, page, DEFAULT_PAGE_SIZE);

  const inStore = (id: string) => visits.some((v) => v.customerId === id && ["ACTIVE", "ASSIGNED", "IDENTIFYING"].includes(v.status));

  return (
    <div className="staff-page">
      <div className="min-w-0">
        <p className="staff-kicker">Directory</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="staff-title mt-1">Customers</h1>
          <SecondaryButton onClick={() => setShowCreate((v) => !v)} className="min-h-[44px]">
            {showCreate ? "Close" : "+ New customer"}
          </SecondaryButton>
        </div>
        <p className="staff-sub">Look up by mobile. Only matching records load — never the whole database.</p>
      </div>

      <Panel className="p-4 sm:p-5">
        <label htmlFor="cust-q" className="sr-only">Search customers</label>
        <div className="relative">
          <TextInput id="cust-q" value={q} onChange={(e) => { setQ(e.target.value); setSearched(false); setRemote(null); setSearching(!!e.target.value.trim()); }} placeholder="Search mobile or name…" inputMode="search" className="tnum py-3 pl-11 pr-10" />
          <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8a29e]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </span>
          {q && (
            <button onClick={() => { setQ(""); setRemote(null); setSearching(false); setSearched(false); }} aria-label="Clear search" className="absolute right-2 top-1/2 grid min-h-[36px] w-9 -translate-y-1/2 place-items-center rounded-lg text-[#78716c] transition-colors hover:bg-[#f3eeea] hover:text-[#1c1917] active:scale-95">✕</button>
          )}
        </div>
        {searching && hasQuery && <div className="mt-2.5"><span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-[13px] font-medium text-[#78716c]"><span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#d6c9bb] border-t-[#b4234d]" />Searching…</span></div>}
      </Panel>

      {created && (
        <Panel className="ui-rise border-[#bfe3cd] bg-[#f2faf5] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#177245]">
              <span aria-hidden className="grid size-5 place-items-center rounded-full bg-[#177245] text-[12px] text-white">✓</span>
              Record created
            </p>
            <button onClick={() => setCreated(null)} aria-label="Dismiss" className="grid min-h-[36px] w-9 place-items-center rounded-lg text-[#78716c] transition-colors hover:bg-white hover:text-[#1c1917] active:scale-95">✕</button>
          </div>
          <div className="mt-3 rounded-xl border border-[#bfe3cd] bg-white p-3.5">
            <CustomerSnapshot customer={created} compact />
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Link href={`/customers/${created.id}`} className="btn-sheen group inline-flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1c1917] px-5 text-[14px] font-semibold text-white transition-all duration-150 hover:-translate-y-px active:translate-y-0 active:scale-[0.98]">
              Open profile <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-1">→</span>
            </Link>
            <SecondaryButton onClick={() => { setCreated(null); setShowCreate(false); }} className="sm:w-40">Done</SecondaryButton>
          </div>
        </Panel>
      )}

      {showCreate && !created && (
        <CreateCustomerCard
          autoFocus
          prefillMobile={queryDigits}
          prefillName={queryDigits ? "" : q.trim()}
          title="New customer"
          body="Two fields is all it takes. The record powers their visits, trials and history."
          onCreated={(c) => { setCreated(c); setShowCreate(false); setQ(""); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Miss: never a dead end — offer to create the record that's missing.
          Only after a real search (3+ chars, finished, no match). The empty
          directory state below stays a lightweight hint, never the full form. */}
      {hasQuery && searched && !searching && !remote && results.length === 0 && !created && !showCreate && (
        <CreateCustomerCard
          compact
          prefillMobile={queryDigits}
          prefillName={queryDigits ? "" : q.trim()}
          title={`No record for “${q.trim()}”.`}
          onCreated={(c) => { setCreated(c); setQ(""); }}
        />
      )}

      {/* Empty directory: hint + action, not the full form by default. */}
      {!hasQuery && results.length === 0 && !created && !showCreate && (
        <Panel className="p-5 text-center sm:p-6">
          <p className="text-[15px] font-semibold tracking-tight">No customer records yet.</p>
          <p className="mx-auto mt-1 max-w-sm text-[13.5px] leading-relaxed text-[#78716c]">Search by mobile to look up, or create the first record to get started.</p>
          <SecondaryButton className="mt-3 min-h-[48px]" onClick={() => setShowCreate(true)}>
            + New customer
          </SecondaryButton>
        </Panel>
      )}

      {results.length > 0 && (
        <>
          <div className="grid gap-2.5 md:grid-cols-2">
            {paged.pageItems.map((c) => (
              <Link key={c.id} href={`/customers/${c.id}`} className="pressable group block rounded-2xl border border-[#e8dfd6] bg-white p-4 sm:p-5">
                {inStore(c.id) && (
                  <p className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#bfe3cd] bg-[#e6f4ec] px-2.5 py-1 text-[12px] font-semibold text-[#177245]">
                    <span aria-hidden className="live-dot inline-block size-1.5 rounded-full bg-[#177245] text-[#177245]" /> In store now
                  </p>
                )}
                <CustomerSnapshot customer={c} compact />
                <span aria-hidden className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-[#b4234d] opacity-0 transition-all duration-150 group-hover:opacity-100">Open profile <span className="transition-transform duration-150 group-hover:translate-x-0.5">→</span></span>
              </Link>
            ))}
          </div>
          <PaginationControls
            page={paged.page} totalPages={paged.totalPages} total={paged.total}
            start={paged.start} end={paged.end} onPage={setPage}
          />
        </>
      )}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" aria-label="Loading" className="staff-page">
          <div className="skeleton-soft h-8 w-48 rounded-xl" />
          <div className="skeleton-soft h-[76px] rounded-2xl" />
          <div className="grid gap-2.5 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-soft h-[120px] rounded-2xl" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        </div>
      }
    >
      <CustomersInner />
    </Suspense>
  );
}
