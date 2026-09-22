"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Btn, EmptyNote, ErrorNote, Field, inputClass, StatusMark } from "@/components/floor/ui";
import { formatMobileIN, isValidMobileIN, normalizeMobile } from "@/lib/domain";
import type { CustomerSnapshotLive } from "@/lib/api";

function CustomersInner() {
  const { searchCustomer, searchCustomersByName, visits, createWalkIn, attachCustomerToVisit, pushToast, customers } = useStore();
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<CustomerSnapshotLive | null>(null);
  const [matches, setMatches] = useState<CustomerSnapshotLive[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  useEffect(() => {
    const query = q.trim();
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const digits = normalizeMobile(query);
      if (query.length < 2 || (digits.length < 3 && query.length < 3)) {
        setRemote(null); setMatches([]); setSearching(false); setSearched(false); return;
      }
      setSearching(true);
      /* Mobile digits → the unique record. A name → every close match, so two
         people sharing one name are picked by mobile, never guessed. */
      if (digits.length >= 3) {
        const c = await searchCustomer(query);
        if (!cancelled) { setRemote(c); setMatches([]); setSearching(false); setSearched(true); }
      } else {
        const list = await searchCustomersByName(query);
        if (!cancelled) { setMatches(list); setRemote(null); setSearching(false); setSearched(true); }
      }
    }, 280);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [q, searchCustomer, searchCustomersByName]);

  const start = async (c: CustomerSnapshotLive) => {
    const existing = visits.find((v) => v.customerId === c.id && ["ACTIVE", "ASSIGNED", "IDENTIFYING", "ARRIVED"].includes(v.status));
    if (existing) { router.push(`/visits/${existing.id}`); return; }
    const v = await createWalkIn();
    if (!v) { setErr("Could not open a walk-in. Check your connection and try again."); return; }
    await attachCustomerToVisit(v.id, c.id);
    pushToast("Walk-in recorded", `${c.name} is attached.`);
    router.push(`/visits/${v.id}`);
  };

  const known = !searched && q.trim().length < 3 ? customers.slice(0, 8) : [];

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-tight">Customers</h1>
      <p className="mt-1 text-[14px] text-[var(--fp-muted)]">Search by name or mobile. Only matching records load.</p>

      <form className="mt-5 max-w-xl" onSubmit={(e) => e.preventDefault()}>
        <Field label="Name or mobile" htmlFor="cust-q">
          <input
            id="cust-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Priya, or 98765 43210"
            autoComplete="off"
            className={inputClass}
          />
        </Field>
      </form>

      {searching && <p className="mt-4 text-[13.5px] font-semibold text-[var(--fp-muted)]">Searching…</p>}
      {err && <div className="mt-4"><ErrorNote title="Could not start the visit." body={err} /></div>}

      {searched && !searching && !remote && matches.length === 0 && (
        <EmptyNote
          title="No customer matches that search."
          body={isValidMobileIN(q) ? `${formatMobileIN(normalizeMobile(q))} is not on file. Start a walk-in and create them there.` : "Try the full mobile number, or a longer name."}
          action={<Btn tone="brand" onClick={() => router.push("/today")}>New walk-in</Btn>}
        />
      )}

      {remote && (
        <article className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--fp-line)] py-4">
          <div>
            <p className="fp-name text-[26px] leading-none">{remote.name}</p>
            <p className="fp-num mt-1 text-[13.5px] text-[var(--fp-muted)]">{formatMobileIN(remote.phone)}</p>
            <p className="mt-1 text-[13px] text-[var(--fp-muted)]">{remote.visitCount} visits · {remote.purchaseCount} purchases</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/customers/${remote.id}`} className="inline-flex min-h-11 items-center px-3 text-[14px] font-semibold">View history</Link>
            <Btn tone="brand" onClick={() => void start(remote)}>Continue visit</Btn>
          </div>
        </article>
      )}

      {matches.length > 0 && (
        <section className="mt-5" aria-label="Matching customers">
          <p className="text-[13px] font-semibold text-[var(--fp-muted)]">
            {matches.length} match{matches.length > 1 ? "es" : ""} — check the mobile before continuing.
          </p>
          <ul className="mt-2">
            {matches.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fp-line)] py-4">
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold">{c.name}</p>
                  <p className="fp-num mt-0.5 text-[13px] text-[var(--fp-muted)]">{formatMobileIN(c.phone)}</p>
                  <p className="mt-0.5 text-[12.5px] text-[var(--fp-muted)]">{c.visitCount} visits · {c.purchaseCount} purchases</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/customers/${c.id}`} className="inline-flex min-h-11 items-center px-3 text-[14px] font-semibold">View history</Link>
                  <Btn tone="brand" onClick={() => void start(c)}>Continue visit</Btn>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {known.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">Seen today</h2>
          <ul>
            {known.map((c) => {
              const live = visits.some((v) => v.customerId === c.id && v.status === "ACTIVE");
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 border-b border-[var(--fp-line)] py-3">
                  <Link href={`/customers/${c.id}`} className="min-w-0">
                    <span className="block text-[15px] font-semibold">{c.name}</span>
                    <span className="fp-num text-[12.5px] text-[var(--fp-muted)]">{formatMobileIN(c.phone)}</span>
                  </Link>
                  {live && <StatusMark value="active" label="In store" />}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="fp-skel h-24" aria-busy="true" />}>
      <CustomersInner />
    </Suspense>
  );
}
