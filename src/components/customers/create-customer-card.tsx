"use client";

/* Create-customer card — extracted from components/ops.tsx (which is being
   slimmed down) so the directory keeps a stable import path. One canonical
   panel for every surface that discovers a missing record. */

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CustomerSnapshotLive } from "@/lib/api";
import { formatMobileIN, friendlyError, isValidMobileIN } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { PrimaryButton, SecondaryButton, TextInput } from "@/components/ui";
import { CustomerSnapshot } from "@/components/ops";

/* ---------- Create customer (the "no record" path) ----------
   One canonical panel for every surface that discovers a missing record: the
   directory, a customer URL that no longer resolves, and a walk-in. Creating
   the record is always offered, prefilled with whatever the operator typed. */

/* Source list matches the floor identify form — same field, same options. */
const CUSTOMER_SOURCES = ["Walk-in", "Instagram", "Meta Lead", "Referral", "Google", "Friend", "Other"] as const;

export function CreateCustomerCard({
  prefillName = "",
  prefillMobile = "",
  defaultSource = "Walk-in",
  title = "No record for this customer yet.",
  body = "Create it now — takes 10 seconds and the visit or profile picks it up immediately.",
  onCreated,
  onCancel,
  autoFocus,
  compact = false,
}: {
  prefillName?: string;
  prefillMobile?: string;
  defaultSource?: string;
  title?: string;
  body?: React.ReactNode;
  onCreated: (customer: CustomerSnapshotLive) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  /** One-line miss row: [Name][Mobile][Source ▾][Create] — source captured at creation. */
  compact?: boolean;
}) {
  const { createCustomer, searchCustomer, pushToast } = useStore();
  const [name, setName] = useState(prefillName);
  const [mobile, setMobile] = useState(prefillMobile);
  const [source, setSource] = useState(defaultSource);
  const [area, setArea] = useState("");
  /* No fabricated default: budget stays unset ("Not asked") unless the FC
     actually asks. The old ₹5–15k default stamped a guess onto records. */
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [existing, setExisting] = useState<CustomerSnapshotLive | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  /* Prefills follow the search box live, but never overwrite a field the
     operator has already typed into. */
  const touched = useRef({ name: false, mobile: false });

  useEffect(() => {
    if (!touched.current.name && prefillName !== name) setName(prefillName);
    if (!touched.current.mobile && prefillMobile !== mobile) setMobile(prefillMobile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillName, prefillMobile]);

  useEffect(() => {
    if (!autoFocus) return;
    // Focus whichever field still needs input.
    (isValidMobileIN(prefillMobile) ? nameRef : mobileRef).current?.focus();
  }, [autoFocus, prefillMobile]);

  const submit = async () => {
    setErr("");
    setExisting(null);
    const cleanName = name.trim();
    if (cleanName.length < 2) { setErr("Enter the customer's name."); nameRef.current?.focus(); return; }
    if (!isValidMobileIN(mobile)) { setErr("Enter a valid 10-digit Indian mobile number."); mobileRef.current?.focus(); return; }
    setBusy(true);
    const r = await createCustomer({ name: cleanName, mobile, source, area: area.trim() || undefined, budget: budget || undefined });
    setBusy(false);
    if (r.ok) {
      pushToast("Customer created", `${r.customer.name} · ${formatMobileIN(r.customer.phone)}`);
      onCreated(r.customer);
      return;
    }
    // A duplicate is not a failure — resolve the existing record and offer it.
    if (r.code === "CUSTOMER_ALREADY_EXISTS") {
      const found = await searchCustomer(mobile);
      if (found) { setExisting(found); return; }
      setErr("That number is already registered. Search it to open the existing record.");
      return;
    }
    setErr(r.message || friendlyError(r.code).body);
  };

  return (
    <>
      {compact && (
        <section className="ui-fade rounded-2xl border border-dashed border-[#d6c9bb] bg-[#faf8f6]/70 px-3 py-2.5" aria-label={title}>
          <form
            className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center"
            onSubmit={(e) => { e.preventDefault(); void submit(); }}
            aria-label="Create customer record"
          >
            <p className="flex min-w-0 items-center gap-2 text-[13.5px] lg:max-w-[240px] lg:shrink-0">
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#fdf0f4] text-[15px] font-bold text-[var(--staff-brand)] ring-1 ring-[var(--staff-brand)]/20">+</span>
              <span className="truncate font-semibold tracking-tight" title={title}>{title}</span>
            </p>
            <label htmlFor="cc-name" className="sr-only">Name</label>
            <TextInput
              id="cc-name"
              ref={nameRef}
              value={name}
              onChange={(e) => { touched.current.name = true; setName(e.target.value); setErr(""); setExisting(null); }}
              placeholder="Name"
              autoComplete="off"
              aria-invalid={!!err && name.trim().length < 2}
              className="lg:max-w-[200px]"
            />
            <label htmlFor="cc-mobile" className="sr-only">Mobile</label>
            <TextInput
              id="cc-mobile"
              ref={mobileRef}
              value={mobile}
              onChange={(e) => { touched.current.mobile = true; setMobile(e.target.value); setErr(""); setExisting(null); }}
              placeholder="Mobile"
              inputMode="tel"
              autoComplete="off"
              className="tnum lg:max-w-[170px]"
              aria-invalid={!!err && !isValidMobileIN(mobile)}
            />
            <span className="flex flex-col gap-1 lg:w-auto lg:flex-row lg:items-center lg:gap-2 lg:shrink-0">
              <label htmlFor="cc-source" className="shrink-0 text-[13px] font-medium whitespace-nowrap text-[#78716c]">
                How did they hear about us?
              </label>
              <select
                id="cc-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border border-[#d6c9bb] bg-white px-3.5 text-[15px] text-[#1c1917] transition-colors hover:border-[#a8a29e] focus:border-[var(--staff-brand)] focus:outline-none focus:ring-4 focus:ring-[var(--staff-brand)]/15 lg:w-[190px] lg:shrink-0"
              >
                {CUSTOMER_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <label htmlFor="cc-area" className="sr-only">Area</label>
              <TextInput
                id="cc-area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Area"
                autoComplete="off"
                className="lg:max-w-[150px]"
              />
              <label htmlFor="cc-budget" className="sr-only">Budget</label>
              <select
                id="cc-budget"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                title="Budget"
                className="min-h-[48px] w-full rounded-xl border border-[#d6c9bb] bg-white px-3.5 text-[15px] text-[#1c1917] lg:w-[140px] lg:shrink-0"
              >
                <option value="">Not asked</option>
                {["Under ₹5k", "₹5–15k", "₹15–30k", "₹30k+"].map((b) => <option key={b}>{b}</option>)}
              </select>
            </span>
            <span className="flex gap-2 lg:ml-auto lg:shrink-0">
              <PrimaryButton type="submit" disabled={busy} className="min-h-[44px] flex-1 px-5 lg:flex-none">
                {busy ? "Creating…" : "Create →"}
              </PrimaryButton>
              {onCancel && (
                <SecondaryButton type="button" onClick={onCancel} disabled={busy} aria-label="Cancel new customer" className="min-h-[44px] px-4">✕</SecondaryButton>
              )}
            </span>
          </form>
          {existing ? (
            <div className="mt-2 flex flex-col gap-2 rounded-xl border border-[#f0d48a] bg-[#fffdf5] p-2.5 lg:flex-row lg:items-center">
              <p className="text-[13px] font-semibold text-[#9a5b00]">That number exists —</p>
              <div className="min-w-0 flex-1"><CustomerSnapshot customer={existing} compact /></div>
              <PrimaryButton onClick={() => onCreated(existing)} className="min-h-[44px] lg:w-auto">Use it →</PrimaryButton>
            </div>
          ) : err ? (
            <p role="alert" className="mt-1.5 text-[13px] font-medium text-[#b4232a]">{err}</p>
          ) : null}
        </section>
      )}
      {!compact && (
    <section className="ui-fade rounded-2xl border border-[var(--staff-brand)]/35 bg-[#fdf0f4]/50 px-3 py-2.5" aria-label={title}>
      {existing ? (
        <div className="ui-fade rounded-xl border border-[#f0d48a] bg-[#fffdf5] p-3">
          <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-[#9a5b00]">
            <span aria-hidden className="grid size-5 place-items-center rounded-full bg-[#fdf1d7] text-[12px] ring-1 ring-[#f0d48a]">!</span>
            That number is already registered.
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#78716c]">Use the existing record instead — history stays in one place.</p>
          <div className="mt-2 rounded-xl border border-[#e8dfd6] bg-white p-3">
            <CustomerSnapshot customer={existing} compact />
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <PrimaryButton onClick={() => onCreated(existing)} className="min-h-[44px] flex-1">Use existing record →</PrimaryButton>
            <Link href={`/customers/${existing.id}`} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#d6c9bb] px-4 text-[13.5px] font-semibold transition-all duration-150 hover:-translate-y-px hover:border-[#1c1917] hover:bg-white active:translate-y-0">
              Open profile
            </Link>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2 xl:flex-row xl:items-center"
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
          aria-label="Create customer record"
        >
          <p className="flex min-w-0 items-center gap-2 text-[13.5px] xl:max-w-[220px] xl:shrink-0">
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#fdf0f4] text-[15px] font-bold text-[var(--staff-brand)] ring-1 ring-[var(--staff-brand)]/20">+</span>
            <span className="min-w-0">
              <span className="block truncate font-semibold tracking-tight" title={title}>{title}</span>
              {typeof body === "string" ? (
                <span className="block truncate text-[12px] font-normal text-[#78716c]" title={body}>{body}</span>
              ) : null}
            </span>
          </p>
          <label htmlFor="cc-name" className="sr-only">Name (required)</label>
          <TextInput
            id="cc-name"
            ref={nameRef}
            value={name}
            onChange={(e) => { touched.current.name = true; setName(e.target.value); setErr(""); }}
            placeholder="Name *"
            autoComplete="off"
            aria-invalid={!!err && name.trim().length < 2}
            className="xl:max-w-[180px]"
          />
          <label htmlFor="cc-mobile" className="sr-only">Mobile (required)</label>
          <TextInput
            id="cc-mobile"
            ref={mobileRef}
            value={mobile}
            onChange={(e) => { touched.current.mobile = true; setMobile(e.target.value); setErr(""); }}
            placeholder="Mobile *"
            inputMode="tel"
            autoComplete="off"
            className="tnum xl:max-w-[150px]"
            aria-invalid={!!err && !isValidMobileIN(mobile)}
          />
          <label htmlFor="cc-source" className="sr-only">How did you hear about us?</label>
          <select
            id="cc-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            title="How did you hear about us?"
            className="min-h-[44px] w-full rounded-xl border border-[#d6c9bb] bg-white px-3 text-[14px] shadow-[inset_0_1px_2px_rgba(28,25,23,0.04)] transition-all duration-150 hover:border-[#a8a29e] focus:border-[var(--staff-brand)] focus:outline-none focus:ring-4 focus:ring-[var(--staff-brand)]/15 xl:max-w-[150px]"
          >
            {CUSTOMER_SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <label htmlFor="cc-area2" className="sr-only">Area</label>
          <TextInput
            id="cc-area2"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Area"
            autoComplete="off"
            className="xl:max-w-[130px]"
          />
          <label htmlFor="cc-budget2" className="sr-only">Budget</label>
          <select
            id="cc-budget2"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            title="Budget"
            className="min-h-[44px] w-full rounded-xl border border-[#d6c9bb] bg-white px-3 text-[14px] xl:max-w-[130px]"
          >
            <option value="">Not asked</option>
                {["Under ₹5k", "₹5–15k", "₹15–30k", "₹30k+"].map((b) => <option key={b}>{b}</option>)}
          </select>
          <span className="flex gap-2 xl:ml-auto xl:shrink-0">
            <PrimaryButton type="submit" disabled={busy} className="min-h-[44px] flex-1 px-5 xl:flex-none">
              {busy ? "Creating…" : "Create →"}
            </PrimaryButton>
            {onCancel && (
              <SecondaryButton type="button" onClick={onCancel} disabled={busy} className="min-h-[44px] px-4">✕</SecondaryButton>
            )}
          </span>
        </form>
      )}
      {!existing && (err ? (
        <p role="alert" className="mt-1.5 text-[13px] font-medium text-[#b4232a]">{err}</p>
      ) : null)}
    </section>
      )}
    </>
  );
}
