"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useCustomerSearch } from "@/features/customers/use-customer-search";
import { createCustomerSchema } from "@/features/customers/schemas";
import { Btn, EmptyNote, ErrorNote, Field, inputClass, StatusMark } from "@/components/floor/ui";
import { formatMobileIN, normalizeMobile } from "@/lib/domain";
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
  const { visits, createWalkIn, attachCustomerToVisit, pushToast, customers, searchCustomer, createCustomer } = useStore();
  // Unified search: one debounce + stale-guard implementation shared with the
  // visit identify flow (previously a third hand-rolled copy that drifted).
  const { query: q, setQuery: setQ, results, searching, searched, error: searchError } = useCustomerSearch();
  const [err, setErr] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);
  const [created, setCreated] = useState<CustomerSnapshotLive | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  // Inline create-form fields (replaces the deleted CreateCustomerCard).
  const [ncName, setNcName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncSource, setNcSource] = useState("Walk-in");
  const [ncArea, setNcArea] = useState("");
  const [ncBudget, setNcBudget] = useState("");
  const [ncSaving, setNcSaving] = useState(false);
  const [ncErr, setNcErr] = useState("");
  const [ncExisting, setNcExisting] = useState<CustomerSnapshotLive | null>(null);
  const router = useRouter();

  // The hook puts the unique mobile hit first, then name matches — split them
  // back out so the directory keeps its single-record card + match list.
  const digits = normalizeMobile(q);
  const remote = digits.length >= 3 ? (results[0] ?? null) : null;
  const matches = digits.length >= 3 ? results.slice(1) : results;

  // Starting a new query clears the create state (done in the input
  // onChange below, not an effect — set-state-in-effect causes cascades).
  const onQueryChange = (v: string) => {
    setQ(v);
    setCreated(null);
    setShowCreate(false);
    setNcErr("");
    setNcExisting(null);
  };

  // Prefill the inline form from the searched query at open time.
  const openCreate = () => {
    setNcName(/[\p{L}]/u.test(q) ? q.trim() : "");
    setNcPhone(digits);
    setNcArea("");
    setNcBudget("");
    setNcErr("");
    setNcExisting(null);
    setShowCreate(true);
  };

  // Inline directory create — same zod schema as the visit identify form, so
  // the rules can never drift apart again. Duplicate resolves the existing
  // record and offers it (never a dead-end error).
  const submitCreate = async () => {
    setNcErr("");
    setNcExisting(null);
    const parsed = createCustomerSchema.safeParse({ name: ncName, phone: ncPhone, source: ncSource, area: ncArea.trim() || undefined, budget: ncBudget || undefined });
    if (!parsed.success) {
      setNcErr(parsed.error.issues[0]?.message ?? "Check the name and number and try again.");
      return;
    }
    setNcSaving(true);
    const r = await createCustomer({ name: parsed.data.name, mobile: parsed.data.phone, source: parsed.data.source, area: parsed.data.area ?? undefined, budget: parsed.data.budget ?? undefined });
    setNcSaving(false);
    if (r.ok) {
      setShowCreate(false);
      setCreated(r.customer);
      pushToast("Customer created", `${r.customer.name} · ${formatMobileIN(r.customer.phone)}`);
      return;
    }
    if (r.code === "CUSTOMER_ALREADY_EXISTS") {
      const found = await searchCustomer(parsed.data.phone);
      if (found) { setNcExisting(found); return; }
      setNcErr("That number is already registered. Search it to open the existing record.");
      return;
    }
    setNcErr(r.message || "Could not save the record. Try again.");
  };

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
              onChange={(e) => onQueryChange(e.target.value)}
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
      {searchError && <div className="mt-1"><ErrorNote title={searchError.title} body={searchError.body} /></div>}

      {searched && !searching && !hasResults && (
        <div className="mt-2">
          <EmptyNote
            title="No customer matches that search."
            body={digits.length >= 6 ? `${formatMobileIN(digits)} is not on file. Create the record — they can start a visit right away.` : "No name match. Create the record with the details you have."}
          />
          {/* Search stays clean: one button starts the record. The form only
              appears once it is wanted, prefilled from what was searched, so a
              walk-in becomes a record without cluttering the search screen. */}
          {!showCreate ? (
            <div className="mt-4">
              <Btn tone="brand" onClick={openCreate}>Create customer</Btn>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-[var(--staff-brand)]/35 bg-[#fdf0f4]/50 px-4 py-3">
              {ncExisting ? (
                <div className="rounded-xl border border-[#f0d48a] bg-[#fffdf5] p-3">
                  <p className="text-[13.5px] font-semibold text-[#9a5b00]">That number is already registered.</p>
                  <p className="mt-0.5 text-[12.5px] text-[#78716c]">Use the existing record instead — history stays in one place.</p>
                  <p className="fp-name mt-2 text-[20px] leading-none">{ncExisting.name}</p>
                  <p className="fp-num mt-1 text-[13px] text-[#78716c]">{formatMobileIN(ncExisting.phone)}</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Btn tone="brand" className="flex-1" onClick={() => { setShowCreate(false); setCreated(ncExisting); setNcExisting(null); }}>Use existing record →</Btn>
                    <Link href={`/customers/${ncExisting.id}`} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#d6c9bb] px-4 text-[13.5px] font-semibold">Open profile</Link>
                  </div>
                </div>
              ) : (
                <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void submitCreate(); }} aria-label="Create customer record">
                  <p className="text-[13.5px] font-semibold tracking-tight">New customer</p>
                  <p className="text-[12.5px] leading-snug text-[#78716c]">Name, mobile and how they found the store — the record is usable the moment it saves.</p>
                  <Field label="Name" htmlFor="nc-name" required>
                    <input id="nc-name" value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="e.g. Priya Shah" autoComplete="off" className={inputClass} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Mobile" htmlFor="nc-mobile" required>
                      <input id="nc-mobile" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} placeholder="+91 98765 43210" inputMode="tel" autoComplete="off" className={inputClass} />
                    </Field>
                    <Field label="How did you hear about us?" htmlFor="nc-source">
                      <select id="nc-source" value={ncSource} onChange={(e) => setNcSource(e.target.value)} className={inputClass}>
                        {["Walk-in", "Instagram", "Meta Lead", "Referral", "Google", "Friend", "Other"].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Area" htmlFor="nc-area" hint="Neighbourhood — e.g. Satellite, Vastrapur.">
                      <input id="nc-area" value={ncArea} onChange={(e) => setNcArea(e.target.value)} placeholder="e.g. Satellite" autoComplete="off" className={inputClass} />
                    </Field>
                    <Field label="Budget" htmlFor="nc-budget">
                      <select id="nc-budget" value={ncBudget} onChange={(e) => setNcBudget(e.target.value)} className={inputClass}>
                        <option value="">Not asked</option>
                        {["Under ₹5k", "₹5–15k", "₹15–30k", "₹30k+"].map((b) => <option key={b}>{b}</option>)}
                      </select>
                    </Field>
                  </div>
                  {ncErr && <p role="alert" className="text-[13px] font-medium text-[#b4232a]">{ncErr}</p>}
                  <div className="flex gap-2">
                    <Btn tone="brand" disabled={ncSaving} onClick={() => void submitCreate()} className="flex-1">{ncSaving ? "Creating…" : "Create →"}</Btn>
                    <Btn tone="line" onClick={() => setShowCreate(false)} className="shrink-0">Cancel</Btn>
                  </div>
                </form>
              )}
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
