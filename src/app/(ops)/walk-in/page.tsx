"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { isValidMobileIN, normalizeMobile, formatMobileIN } from "@/lib/domain";
import { Panel, PrimaryButton, SecondaryButton, Field, TextInput, ErrorBlock, StatusBadge, InlineSaving, ConfirmDialog, SectionTitle } from "@/components/ui";
import { VisitHeader, CustomerSnapshot, HistoryLayers, FCSelector, Stepper } from "@/components/ops";
import type { CustomerSnapshotLive } from "@/lib/api";

/* Stage 2 core flow (§11-18): identify → assign → start, with the persistent
   visit header always answering "which customer am I working with?". */

function WalkInInner() {
  const store = useStore();
  const { getVisit, getCustomer, searchCustomer, createCustomer, attachCustomerToVisit, startVisit, abandonVisit, pushToast, salespeople } = store;
  const params = useSearchParams();
  const router = useRouter();
  const visitId = params.get("visit") || "";

  const visit = visitId ? getVisit(visitId) : undefined;
  const customer = visit?.customerId ? getCustomer(visit.customerId) : undefined;
  const fc = salespeople.find((s) => s.id === visit?.assignedSalespersonId);

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<CustomerSnapshotLive | null>(null);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [err, setErr] = useState<{ title: string; body: string; action?: string; existingId?: string } | null>(null);

  // New customer form (intentionally short, §15)
  const [ncName, setNcName] = useState("");
  const [ncMobile, setNcMobile] = useState("");
  const [ncSource, setNcSource] = useState("Walk-in");
  const [ncBusy, setNcBusy] = useState(false);
  const [ncErr, setNcErr] = useState("");

  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const searchBox = useRef<HTMLInputElement>(null);

  useEffect(() => { searchBox.current?.focus(); }, [visitId]);

  // Debounced forgiving search (§23: paste + partial + normalization).
  // All setState happens inside the timer callback, never synchronously in the
  // effect body (React Compiler "set-state-in-effect").
  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    const t = window.setTimeout(async () => {
      if (!q) { setResult(null); setSearched(false); setSearching(false); return; }
      setSearching(true);
      const c = await searchCustomer(query);
      if (!cancelled) {
        setResult(c);
        setSearched(true);
        setSearching(false);
        // Found a match after create was opened — drop the stale form.
        if (c) setShowCreate(false);
      }
    }, 220);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [query, searchCustomer]);

  const step = useMemo(() => {
    if (!visit) return 0;
    if (visit.status === "ACTIVE") return 3;
    if (visit.assignedSalespersonId && visit.customerId) return 2;
    if (visit.customerId) return 2;
    return 1;
  }, [visit]);

  if (!visitId || !visit) {
    return (
      <Panel className="p-6">
        <h1 className="text-[18px] font-semibold">No walk-in open.</h1>
        <p className="mt-1 text-[14px] text-[#78716c]">Walk-ins are created the moment a customer arrives. Use New walk-in on Today.</p>
        <Link href="/today" className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-[#1c1917] px-4 text-[14px] font-semibold text-white">Back to Today</Link>
      </Panel>
    );
  }

  const selectCustomer = async (id: string) => {
    setErr(null);
    const r = await attachCustomerToVisit(visit.id, id);
    if (!r.ok) {
      setErr({ title: "Could not attach customer.", body: r.message ?? "Try again once." });
      return;
    }
    const c = await searchCustomer("");
    void c;
    pushToast("Customer attached", "Now assign an FC.");
  };

  const submitNewCustomer = async () => {
    setNcErr("");
    if (!ncName.trim()) { setNcErr("Enter the customer's name."); return; }
    if (!isValidMobileIN(ncMobile)) { setNcErr("Enter a valid 10-digit mobile number."); return; }
    setNcBusy(true);
    const r = await createCustomer({ name: ncName, mobile: ncMobile, source: ncSource });
    if (!r.ok) {
      setNcBusy(false);
      if (r.code === "CUSTOMER_ALREADY_EXISTS" || r.code === "DUPLICATE_MOBILE") {
        setErr({ title: "That mobile number is already registered.", body: "Open the existing customer instead of creating a duplicate." });
      } else {
        setNcErr(r.message ?? "Could not create customer.");
      }
      return;
    }
    // Auto-attach (§15): never make the salesperson reconnect manually
    const a = await attachCustomerToVisit(visit.id, r.customer.id);
    setNcBusy(false);
    if (!a.ok) {
      setErr({ title: `${r.customer.name} was created but couldn't be attached.`, body: "Search for them by mobile and attach to continue." });
      return;
    }
    pushToast(`${r.customer.name} created & attached`, "Now assign an FC.");
    setShowCreate(false);
    setQuery(normalizeMobile(ncMobile));
  };

  const beginVisit = async () => {
    const r = await startVisit(visit.id);
    if (!r.ok) {
      setErr({ title: "Could not start the visit.", body: r.message ?? "Check the FC is assigned and try again." });
      return;
    }
    pushToast("Visit started", `${customer?.name ?? "Customer"} is now with ${fc?.name ?? "their FC"}.`);
  };

  const prefillFromQuery = () => {
    const digits = normalizeMobile(query || ncMobile);
    if (digits) setNcMobile(digits);
  };

  return (
    <div className="staff-page">
      <VisitHeader visit={visit} customer={customer} fcName={fc?.name} />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-[#e8dfd6] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
        <Stepper steps={["Arrived", "Identify", "Assign", "Ready"]} current={visit.status === "ACTIVE" ? 3 : step} />
        <div className="flex items-center gap-2.5 text-[13px]">
          <StatusBadge value={visit.status} />
          <button onClick={() => setConfirmAbandon(true)} className="min-h-[36px] rounded-lg px-2 font-semibold text-[#78716c] underline-offset-2 transition-colors hover:bg-[#fdecec] hover:text-[#b4232a] hover:underline active:scale-[0.97]">
            End visit
          </button>
        </div>
      </div>

      {err && (
        <ErrorBlock
          title={err.title} body={err.body}
          actionLabel={err.action && err.existingId ? err.action : undefined}
          onAction={err.existingId ? () => { void selectCustomer(err.existingId!); setErr(null); } : undefined}
        />
      )}

      {/* Visit READY state — confirmation + handoff (§44) */}
      {visit.status === "ACTIVE" ? (
        <Panel className="ui-rise relative overflow-hidden p-6 text-center sm:p-8">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#177245] via-[#1fae5f] to-[#177245]" />
          <p className="inline-flex items-center gap-1.5 rounded-full border border-[#bfe3cd] bg-[#e6f4ec] px-3 py-1 text-[12px] font-bold tracking-wide text-[#177245]"><span aria-hidden>✓</span> VISIT READY</p>
          <h2 className="staff-title mt-2">{customer?.name}</h2>
          <p className="mt-1 text-[14px] text-[#57534e]">
            Assigned to <strong>{fc?.name}</strong> · Arrived {new Date(visit.arrivedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
            {customer ? ` · ${customer.visitCount} previous visits` : ""}
          </p>
          <div className="mx-auto mt-5 flex max-w-md flex-col gap-2">
            <Link href={`/visits/${visit.id}`} className="btn-sheen group inline-flex min-h-[52px] items-center justify-center gap-1.5 rounded-2xl bg-[#b4234d] px-6 text-[16px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(180,35,77,0.6)] transition-all duration-150 hover:-translate-y-px hover:bg-[#93183d] active:translate-y-0 active:scale-[0.98]">
              Open active visit <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-1">→</span>
            </Link>
            <Link href="/today" className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[#d6c9bb] px-4 text-[14px] font-semibold transition-all duration-150 hover:-translate-y-px hover:border-[#1c1917] hover:bg-[#faf8f6] active:translate-y-0">
              Back to Today
            </Link>
          </div>
          <p className="mt-4 text-[13px] text-[#78716c]">Next: <strong className="text-[#1c1917]">Stage 3 — On the floor</strong> continues this same visit.</p>
        </Panel>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
          {/* STEP: Identify */}
          <Panel className="p-5 sm:p-6">
            <SectionTitle kicker="Step 1 · Identify" title="Find customer" />
            <p className="staff-sub">Mobile number is fastest. Name works too.</p>

            <div className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <TextInput
                  ref={searchBox}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setErr(null); setSearched(false); setResult(null); setShowCreate(false); setSearching(!!e.target.value.trim()); }}
                  placeholder="+91 · type or paste mobile or name"
                  inputMode="tel"
                  aria-label="Search by mobile number or name"
                  className="tnum py-3 pl-11 pr-10"
                />
                <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8a29e]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                </span>
                {query && (
                  <button onClick={() => { setQuery(""); setResult(null); setSearched(false); setSearching(false); setShowCreate(false); searchBox.current?.focus(); }}
                    aria-label="Clear search" className="absolute right-2 top-1/2 grid min-h-[36px] w-9 -translate-y-1/2 place-items-center rounded-lg text-[#78716c] transition-colors hover:bg-[#f3eeea] hover:text-[#1c1917] active:scale-95">
                    ✕
                  </button>
                )}
              </div>
            </div>
            {searching && <div className="mt-2.5"><InlineSaving label="Searching…" /></div>}

            <div className="mt-4 flex flex-col gap-2" aria-live="polite">
              {result && (
                <div className={`ui-fade rounded-2xl border p-4 transition-colors duration-150 ${visit.customerId === result.id ? "border-[#177245] bg-[#f2faf5]" : "border-[#e8dfd6] bg-white hover:border-[#d6c9bb]"}`}>
                  <CustomerSnapshot customer={result} compact />
                  <div className="mt-3 flex gap-2">
                    {visit.customerId === result.id ? (
                      <p className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-semibold text-[#177245]"><span aria-hidden className="grid size-5 place-items-center rounded-full bg-[#177245] text-[12px] text-white">✓</span> Attached to this visit</p>
                    ) : (
                      <PrimaryButton onClick={() => void selectCustomer(result.id)} className="min-h-[48px] flex-1 text-[14.5px]">
                        Use this customer →
                      </PrimaryButton>
                    )}
                    <Link href={`/customers/${result.id}`} className="inline-flex min-h-[48px] items-center rounded-xl border border-[#d6c9bb] px-4 text-[13.5px] font-semibold transition-all duration-150 hover:-translate-y-px hover:border-[#1c1917] hover:bg-[#faf8f6] active:translate-y-0">
                      Details
                    </Link>
                  </div>
                </div>
              )}

              {searched && !searching && !result && query.trim().length >= 3 && (
                <div className="rounded-2xl border border-dashed border-[#d6c9bb] bg-[#faf8f6]/70 p-5 text-center sm:p-6">
                  <span aria-hidden className="empty-plate mx-auto">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>
                  </span>
                  <p className="mt-2 text-[15px] font-semibold tracking-tight text-balance">No customer found{query ? <> for “{query.trim()}”</> : ""}.</p>
                  <p className="mx-auto mt-1 max-w-sm text-[13.5px] leading-relaxed text-[#78716c]">Create them now — it takes 10 seconds. They attach to this visit automatically.</p>
                  <SecondaryButton className="mt-3 min-h-[48px] border-[#b4234d]/40 bg-[#fdf0f4] text-[#8f1b3d] hover:border-[#b4234d] hover:bg-[#fbe9ef] hover:text-[#8f1b3d]" onClick={() => { setShowCreate(true); prefillFromQuery(); }}>
                    + Create new customer
                  </SecondaryButton>
                </div>
              )}

              {!searched && (
                <p className="flex items-start gap-2 rounded-xl bg-[#faf8f6] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#78716c]">
                  <span aria-hidden className="mt-px">💡</span>
                  Tip: paste the number straight from WhatsApp or the Meta lead sheet — spaces and +91 are handled.
                </p>
              )}
            </div>

            {/* New customer — intentionally short inline form (§15, §25) */}
            {showCreate && (
              <div className="ui-rise mt-4 rounded-2xl border border-[#b4234d]/30 bg-[#fdf0f4]/50 p-4 sm:p-5">
                <h3 className="staff-h2">New customer</h3>
                <p className="mt-0.5 text-[13px] text-[#78716c]">10 seconds — they attach to this visit automatically.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Name" required htmlFor="nc-name">
                    <TextInput id="nc-name" value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="Customer name" autoComplete="off" />
                  </Field>
                  <Field label="Mobile" required htmlFor="nc-mobile" hint="10-digit Indian mobile.">
                    <TextInput id="nc-mobile" value={ncMobile} onChange={(e) => setNcMobile(e.target.value)} placeholder="98765 43210" inputMode="tel" className="tnum" />
                  </Field>
                </div>
                <div className="mt-3">
                  <Field label="How did you hear about us?" htmlFor="nc-source">
                    <select id="nc-source" value={ncSource} onChange={(e) => setNcSource(e.target.value)} className="min-h-[48px] w-full rounded-xl border border-[#d6c9bb] bg-white px-3.5 text-[15px] shadow-[inset_0_1px_2px_rgba(28,25,23,0.04)] transition-all duration-150 hover:border-[#a8a29e] focus:border-[#b4234d] focus:outline-none focus:ring-4 focus:ring-[#b4234d]/15">
                      {["Walk-in", "Instagram", "Meta Lead", "Referral", "Google", "Other"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>
                {ncErr && <p role="alert" className="mt-2 text-[13.5px] font-medium text-[#b4232a]">{ncErr}</p>}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <PrimaryButton onClick={() => void submitNewCustomer()} disabled={ncBusy} className="flex-1">
                    {ncBusy ? "Creating…" : `Create${ncMobile ? ` ${formatMobileIN(ncMobile)}` : ""} →`}
                  </PrimaryButton>
                  <SecondaryButton onClick={() => setShowCreate(false)}>Cancel</SecondaryButton>
                </div>
              </div>
            )}
          </Panel>

          {/* STEP: Assign + history side by side */}
          <div className="flex flex-col gap-4">
            <Panel className={`p-5 transition-opacity duration-200 sm:p-6 ${!customer ? "opacity-70" : ""}`}>
              <SectionTitle kicker="Step 2 · Assign" title="Assign FC" />
              {!customer ? (
                <p className="staff-sub">Attach a customer first — then pick who serves them.</p>
              ) : (
                <>
                  <p className="staff-sub">Serving <strong className="font-semibold text-[#1c1917]">{customer.name}</strong></p>
                  <div className="mt-3.5">
                    <FCSelector visitId={visit.id} onDone={() => setErr(null)} />
                  </div>
                </>
              )}
            </Panel>

            {customer && (
              <Panel className="p-5 sm:p-6">
                <h2 className="staff-h2">Recent visits — {customer.name.split(" ")[0]}</h2>
                <div className="mt-3"><HistoryLayers customerId={customer.id} /></div>
              </Panel>
            )}

            {/* Start visit — only enabled when truth allows it (§17) */}
            <Panel className={`relative overflow-hidden p-5 sm:p-6 ${customer && visit.assignedSalespersonId ? "border-[#177245]/40" : ""}`}>
              {customer && visit.assignedSalespersonId ? (
                <>
                  <PrimaryButton onClick={() => void beginVisit()} className="btn-sheen w-full text-[15.5px]">
                    Start visit — {customer.name.split(" ")[0]} with {fc?.name} →
                  </PrimaryButton>
                  <p className="mt-2.5 text-center text-[12.5px] text-[#78716c]">This hands off to Stage 3 on the same visit.</p>
                </>
              ) : (
                <>
                  <PrimaryButton disabled className="w-full">Start visit</PrimaryButton>
                  <p className="mt-2.5 text-center text-[12.5px] text-[#78716c]">
                    {!customer ? "Find or create the customer to continue." : "Assign an FC to continue."}
                  </p>
                </>
              )}
              <div className="mt-3 border-t border-[#e8dfd6] pt-3">
                <p className="staff-kicker">This visit so far</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#78716c]">Arrived {new Date(visit.arrivedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}{visit.assignedAt ? ` · FC assigned ${new Date(visit.assignedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : ""}</p>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {confirmAbandon && (
        <ConfirmDialog
          title="End this visit?"
          body={customer ? `${customer.name} will leave the active queue. Their record stays saved — you can start a fresh walk-in if they return.` : "This arrival will leave the queue. Nothing else is affected."}
          confirmLabel="End visit"
          danger
          onCancel={() => setConfirmAbandon(false)}
          onConfirm={() => { void abandonVisit(visit.id); setConfirmAbandon(false); pushToast("Visit ended", "The queue updated."); router.push("/today"); }}
        />
      )}
    </div>
  );
}

export default function WalkInPage() {
  return (
    <Suspense fallback={
      <div aria-busy="true" aria-label="Loading" className="staff-page">
        <div className="skeleton-soft h-[120px] rounded-2xl" />
        <div className="skeleton-soft h-[200px] rounded-2xl" />
        <p className="sr-only">Opening walk-in…</p>
      </div>
    }>
      <WalkInInner />
    </Suspense>
  );
}
