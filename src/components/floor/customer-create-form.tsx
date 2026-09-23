"use client";

import { useState } from "react";
import { Btn, Field, inputClass } from "@/components/floor/ui";
import { CUSTOMER_BUDGETS, CUSTOMER_SOURCES } from "@/features/customers/schemas";

export interface CustomerCreateData {
  name: string;
  phone: string;
  source: string;
  area: string;
  budget: string;
}

/* The single "new customer" form for the whole app — the visit identify step
   and the customers directory render this same component, so field order,
   labels and options can never drift apart again.

   Name + mobile are the whole job; source / area / budget sit behind an
   explicit "More details" disclosure so a walk-in becomes a record in two
   fields while the customer is standing in front of you. */
export function CustomerCreateForm({
  idPrefix,
  initialName = "",
  initialPhone = "",
  contextLine,
  submitLabel = "Create customer",
  saving = false,
  error,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  initialName?: string;
  initialPhone?: string;
  /** e.g. No record for "98765 43210". Shown under the heading when given. */
  contextLine?: string;
  submitLabel?: string;
  saving?: boolean;
  error?: string | null;
  onSubmit: (data: CustomerCreateData) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [source, setSource] = useState<string>("Walk-in");
  const [area, setArea] = useState("");
  const [budget, setBudget] = useState("");

  return (
    <form
      className="fp-rise mt-5 max-w-md"
      aria-label="Create customer record"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, phone, source, area: area.trim(), budget });
      }}
    >
      <h3 className="text-[16px] font-semibold">New customer</h3>
      <p className="mt-1 text-[13.5px] leading-snug text-[var(--fp-muted)]">
        {contextLine ?? "Name and mobile is enough — the rest can wait until later."}
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <Field label="Name" htmlFor={`${idPrefix}-name`} required hint="Same names are common — the mobile number tells them apart.">
          <input
            id={`${idPrefix}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priya Shah"
            autoComplete="off"
            autoFocus
            className={inputClass}
          />
        </Field>
        <Field label="Mobile" htmlFor={`${idPrefix}-mobile`} required>
          <input
            id={`${idPrefix}-mobile`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            inputMode="tel"
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <details className="rounded-xl border border-[var(--fp-line)] bg-[var(--fp-surface)] px-3.5 py-2.5">
          <summary className="cursor-pointer text-[13.5px] font-semibold text-[var(--fp-muted)] hover:text-[var(--fp-ink)]">
            More details <span className="font-normal">(optional)</span>
          </summary>
          <div className="flex flex-col gap-3 pb-1.5 pt-3">
            <Field label="How did they hear about us?" htmlFor={`${idPrefix}-source`}>
              <select id={`${idPrefix}-source`} value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
                {CUSTOMER_SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Area" htmlFor={`${idPrefix}-area`} hint="e.g. Satellite, Vastrapur.">
                <input
                  id={`${idPrefix}-area`}
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Satellite"
                  autoComplete="off"
                  className={inputClass}
                />
              </Field>
              <Field label="Budget" htmlFor={`${idPrefix}-budget`}>
                <select id={`${idPrefix}-budget`} value={budget} onChange={(e) => setBudget(e.target.value)} className={inputClass}>
                  <option value="">Not asked</option>
                  {CUSTOMER_BUDGETS.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </details>
        {error && (
          <p role="alert" className="text-[13px] font-medium text-[var(--fp-drop)]">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Btn type="submit" tone="brand" disabled={saving} className="flex-1">
            {saving ? "Creating…" : submitLabel}
          </Btn>
          {onCancel && (
            <Btn type="button" tone="line" onClick={onCancel} className="shrink-0">
              Cancel
            </Btn>
          )}
        </div>
      </div>
    </form>
  );
}
