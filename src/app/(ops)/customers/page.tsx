"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Btn, EmptyNote, ErrorNote, StatusMark } from "@/components/floor/ui";
import { CreateCustomerCard } from "@/components/customers/create-customer-card";
import { formatMobileIN, isValidMobileIN, normalizeMobile } from "@/lib/domain";
import type { CustomerSnapshotLive } from "@/lib/api";

/* Search-first: the customer standing in front of you is the whole screen.
   One large field, centered. Records load the instant they match. */
const heroInput =
  "min-h-[58px] w-full rounded-xl border border-[var(--fp-line-strong)] bg-[var(--fp-surface)] pl-[52px] pr-4 text-[18px] text-[var(--fp-ink)] placeholder:text-[var(--fp-faint)] focus:border-[var(--fp-ink)] focus:outline-none";

function SearchGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--fp-faint)]">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CustomersInner() {
  const { searchCustomer, searchCustomersByName, visits, createWalkIn, attachCustomerToVisit, pushToast, customers } = useStore();
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<CustomerSnapshotLive | null>(null);
  const [matches, setMatches] = useState<CustomerSnapshotLive[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [err, setErr] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);
  const [created, setCreated] = useState<CustomerSnapshotLive | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const query = q.trim();
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const digits = normalizeMobile(query);
      if (query.length < 2 || (digits.length < 3 && query.length < 3)) {
        setRemote(null); setMatches([]); setCreated(null); setShowCreate(false); setSearching(false); setSearched(false); return;
      }
      setSearching(true);
      setCreated(null);
      setShowCreate(false);
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
    if (startingId) return;
    setStartingId(c.id);
    const v = await createWalkIn();
    if (!v) { setStartingId(null); setErr("Could not open a walk-in. Check your connection and try again."); return; }
    await attachCustomerToVisit(v.id, c.id);
    setStartingId(null);
    pushToast("Walk-in recorded", `${c.name} is attached.`);
    router.push(`/visits/${v.id}`);
  };

  const idle = !searched && q.trim().length < 3;
  const known = idle ? customers.slice(0, 8) : [];
  const hasResults = !!remote || matches.length > 0;

  /* Same names are common — count them so the list can call out which rows
     are ambiguous and lead with the mobile number instead. */
  const nameCounts = new Map<string, number>();
  for (const c of matches) nameCounts.set(c.name, (nameCounts.get(c.name) ?? 0) + 1);
  const sharedNames = [...nameCounts.values()].filter((n) => n > 1).length;
  const isShared = (name: string) => (nameCounts.get(name) ?? 0) > 1;

  return (
    <div className="mx-auto max-w-2xl">
      <div className={idle ? "pt-8 sm:pt-16" : "pt-2"}>
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--fp-faint)]">Customers</p>
        <h1 className="fp-name mt-2 text-[30px] leading-[1.05]">Who&apos;s in front of you?</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--fp-muted)]">
          Search by name or mobile. The record loads the moment it matches — no lists to scroll.
        </p>

        <form className="mt-5" onSubmit={(e) => e.preventDefault()} role="search">
          <div className="relative">
            <SearchGlyph />
            <input
              id="cust-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Priya Shah, or 98765 43210"
              autoComplete="off"
              autoFocus
              aria-label="Search customers by name or mobile"
              className={heroInput}
            />
          </div>
        </form>

        <p aria-live="polite" className="mt-2 min-h-[18px] text-[13px] font-semibold text-[var(--fp-muted)]">
          {searching ? "Searching…" : ""}
        </p>
      </div>

      {err && <div className="mt-1"><ErrorNote title="Could not start the visit." body={err} /></div>}

      {searched && !searching && !hasResults && (
        <div className="mt-2">
          <EmptyNote
            title="No customer matches that search."
            body={isValidMobileIN(q) ? `${formatMobileIN(normalizeMobile(q))} is not on file. Create the record — they can start a visit right away.` : "No name match. Create the record with the details you have."}
          />
          {/* Search stays clean: one button starts the record. The form only
              appears once it is wanted, prefilled from what was searched, so a
              walk-in becomes a record without cluttering the search screen. */}
          {!showCreate ? (
            <div className="mt-4">
              <Btn tone="brand" onClick={() => setShowCreate(true)}>Create customer</Btn>
            </div>
          ) : (
            <div className="mt-4">
              <CreateCustomerCard
                prefillName={isValidMobileIN(q) ? "" : q}
                prefillMobile={isValidMobileIN(q) ? normalizeMobile(q) : ""}
                autoFocus={isValidMobileIN(q)}
                title="New customer"
                body="Name, mobile and how they found the store — the record is usable the moment it saves."
                onCreated={(c) => {
                  setShowCreate(false);
                  setCreated(c);
                  pushToast("Customer created", `${c.name} · ${formatMobileIN(c.phone)}`);
                }}
                onCancel={() => setShowCreate(false)}
              />
            </div>
          )}
        </div>
      )}

      {created && (
        <article className="fp-rise mt-4 rounded-xl border border-[#bfe3cd] bg-[#f2faf5] p-5">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#177245]">Record created</p>
          <p className="fp-name mt-1.5 text-[26px] leading-none">{created.name}</p>
          <p className="fp-num mt-1.5 text-[13.5px] text-[#43544c]">{formatMobileIN(created.phone)}</p>
          <div className="mt-3">
            <Btn tone="brand" disabled={startingId === created.id} onClick={() => void start(created)}>
              {startingId === created.id ? "Opening…" : "Start their visit"}
            </Btn>
          </div>
        </article>
      )}

      {remote && (
        <article className="fp-rise mt-1 rounded-xl border border-[var(--fp-line)] bg-[var(--fp-surface)] p-5 shadow-[var(--fp-shadow)]">
          <p className="fp-name text-[28px] leading-none">{remote.name}</p>
          <p className="fp-num mt-2 text-[14px] text-[var(--fp-muted)]">{formatMobileIN(remote.phone)}</p>
          <p className="fp-num mt-1 text-[13px] text-[var(--fp-muted)]">{remote.visitCount} visits · {remote.purchaseCount} purchases</p>
          <div className="mt-4 flex items-center gap-2">
            <Btn tone="brand" disabled={startingId === remote.id} onClick={() => void start(remote)}>
              {startingId === remote.id ? "Opening…" : "Continue visit"}
            </Btn>
            <Link href={`/customers/${remote.id}`} className="inline-flex min-h-11 items-center rounded-lg px-3 text-[14px] font-semibold text-[var(--fp-muted)] hover:text-[var(--fp-ink)]">
              View history
            </Link>
          </div>
        </article>
      )}

      {matches.length > 0 && (
        <section className="mt-1" aria-label="Matching customers">
          <p className="text-[13px] font-semibold text-[var(--fp-muted)]">
            {matches.length} match{matches.length > 1 ? "es" : ""}
            {sharedNames > 0
              ? ` — ${sharedNames} name${sharedNames > 1 ? "s are" : " is"} shared; the mobile number tells them apart.`
              : " — check the mobile before continuing."}
          </p>
          <ul className="fp-rise mt-2">
            {matches.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fp-line)] py-4">
                <div className="min-w-0">
                  <p className="fp-name text-[20px] leading-none">{c.name}</p>
                  <p className={`fp-num mt-1.5 text-[13px] ${isShared(c.name) ? "font-semibold text-[var(--fp-ink)]" : "text-[var(--fp-muted)]"}`}>
                    {isShared(c.name) ? `${formatMobileIN(c.phone)} — pick by mobile` : `${formatMobileIN(c.phone)} · ${c.visitCount} visits · ${c.purchaseCount} purchases`}
                  </p>
                  {isShared(c.name) && (
                    <p className="fp-num text-[12.5px] text-[var(--fp-muted)]">{c.visitCount} visits · {c.purchaseCount} purchases</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/customers/${c.id}`} className="inline-flex min-h-11 items-center px-3 text-[14px] font-semibold text-[var(--fp-muted)] hover:text-[var(--fp-ink)]">History</Link>
                  <Btn tone="brand" disabled={startingId === c.id} onClick={() => void start(c)}>
                    {startingId === c.id ? "Opening…" : "Continue visit"}
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {known.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--fp-faint)]">Seen today</h2>
          <ul className="mt-2">
            {known.map((c) => {
              const live = visits.some((v) => v.customerId === c.id && v.status === "ACTIVE");
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 border-b border-[var(--fp-line)] py-3">
                  <Link href={`/customers/${c.id}`} className="min-w-0">
                    <span className="block text-[15.5px] font-semibold">{c.name}</span>
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
