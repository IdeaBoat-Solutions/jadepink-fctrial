"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Btn, Drawer, EmptyNote, ErrorNote, Field, inputClass } from "@/components/floor/ui";
import { formatMobileIN, isValidMobileIN, normalizeMobile } from "@/lib/domain";
import { formatDateIN } from "@/lib/utils";
import type { CustomerSnapshotLive } from "@/lib/api";

const SOURCES = ["Walk-in", "Instagram", "Meta Lead", "Referral", "Google", "Friend", "Other"];
const BUDGETS = ["Under ₹5k", "₹5–15k", "₹15–30k", "₹30k+"];

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, getCustomer, fetchCustomer, visits, createWalkIn, attachCustomerToVisit, pushToast, updateCustomer } = useStore();
  const cached = getCustomer(id);
  const [remote, setRemote] = useState<CustomerSnapshotLive | null>(null);
  const [missing, setMissing] = useState(false);
  const [checking, setChecking] = useState(!cached);
  const [starting, setStarting] = useState(false);
  const [startErr, setStartErr] = useState("");
  const [editing, setEditing] = useState(false);
  const isManager = user?.role === "manager";

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    void (async () => {
      const c = await fetchCustomer(id);
      if (cancelled) return;
      if (c) setRemote(c);
      else setMissing(true);
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [id, cached, fetchCustomer]);

  /* The directory cache is the truth on screen: manager edits and new visits
     flow through it, so the profile updates without a refetch dance. */
  const customer = cached ?? remote;

  if (checking && !customer) {
    return <div aria-busy="true" aria-label="Loading customer"><div className="fp-skel h-8 w-40" /><div className="fp-skel mt-4 h-20" /></div>;
  }

  if (!customer || missing) {
    return (
      <div>
        <Link href="/customers" className="text-[13.5px] font-semibold text-[var(--fp-muted)]">Customers</Link>
        <div className="mt-4">
          <ErrorNote title="This customer record doesn't exist." body="The link may be out of date. Search again by mobile." action={<Btn tone="line" onClick={() => router.push("/customers")}>Search</Btn>} />
        </div>
      </div>
    );
  }

  const liveVisit = visits.find((v) => v.customerId === customer.id && ["ACTIVE", "ASSIGNED", "IDENTIFYING", "ARRIVED"].includes(v.status));
  const past = visits.filter((v) => v.customerId === customer.id);

  const startVisitForCustomer = async () => {
    if (starting) return;
    setStarting(true);
    setStartErr("");
    const v = await createWalkIn();
    if (!v) {
      setStarting(false);
      setStartErr("Could not open a walk-in. Check your connection and try again.");
      return;
    }
    const a = await attachCustomerToVisit(v.id, customer.id);
    setStarting(false);
    pushToast(a.ok ? "Walk-in recorded" : "Walk-in opened", a.ok ? `${customer.name} is attached.` : "Attach them on the next screen.");
    router.push(`/visits/${v.id}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Link href="/customers" className="text-[13.5px] font-semibold text-[var(--fp-muted)]">Customers</Link>
        {isManager && <Btn tone="quiet" onClick={() => setEditing(true)}>Edit record</Btn>}
      </div>
      <h1 className="fp-name mt-3 text-[34px] leading-none">{customer.name}</h1>
      <p className="fp-num mt-2 text-[14px] text-[var(--fp-muted)]">{formatMobileIN(customer.phone)}</p>
      {(customer.area || customer.budget || customer.source) && (
        <p className="mt-1.5 text-[13.5px] text-[var(--fp-muted)]">
          {[customer.area, customer.budget, customer.source ? `via ${customer.source}` : null].filter(Boolean).join(" · ")}
        </p>
      )}
      <dl className="mt-4 flex gap-8 text-[14px]">
        <div><dt className="text-[12px] text-[var(--fp-faint)]">Visits</dt><dd className="fp-num text-[20px] font-semibold">{customer.visitCount}</dd></div>
        <div><dt className="text-[12px] text-[var(--fp-faint)]">Purchases</dt><dd className="fp-num text-[20px] font-semibold">{customer.purchaseCount}</dd></div>
        <div><dt className="text-[12px] text-[var(--fp-faint)]">Last visit</dt><dd className="font-semibold">{customer.lastVisitAt ? formatDateIN(customer.lastVisitAt) : "First visit"}</dd></div>
      </dl>

      <div className="mt-6">
        {liveVisit ? (
          <Link href={`/visits/${liveVisit.id}`} className="inline-flex min-h-12 items-center rounded-lg bg-[var(--fp-brand)] px-5 text-[15px] font-semibold text-white">
            Continue visit
          </Link>
        ) : (
          <div>
            {startErr && <p role="alert" className="mb-2 text-[13.5px] font-medium text-[var(--fp-drop)]">{startErr}</p>}
            <Btn tone="brand" disabled={starting} onClick={() => void startVisitForCustomer()}>
              {starting ? "Recording…" : "New walk-in"}
            </Btn>
          </div>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">Recent activity</h2>
        {past.length === 0 ? (
          <EmptyNote title="No visits recorded for this customer yet." body="A walk-in today becomes the first line of their history." />
        ) : (
          <ul className="mt-2">
            {past.map((v) => (
              <li key={v.id}>
                <Link href={`/visits/${v.id}`} className="flex items-center justify-between border-b border-[var(--fp-line)] py-3 text-[14.5px]">
                  <span>
                    <span className="font-semibold">{formatDateIN(v.arrivedAt) || "Today"}</span>
                    <span className="ml-2 text-[var(--fp-muted)]">{v.fcName || "FC unassigned"}</span>
                  </span>
                  <span className="text-[13px] text-[var(--fp-muted)]">{v.status === "ACTIVE" ? "On the floor" : v.status === "COMPLETED" ? "Completed" : "In progress"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <EditDrawer
          customer={customer}
          onClose={() => setEditing(false)}
          onSaved={(name) => {
            setEditing(false);
            pushToast("Record updated", name);
          }}
          save={updateCustomer}
        />
      )}
    </div>
  );
}

function EditDrawer({
  customer,
  onClose,
  onSaved,
  save,
}: {
  customer: CustomerSnapshotLive;
  onClose: () => void;
  onSaved: (name: string) => void;
  save: (id: string, input: { name?: string; phone?: string; source?: string; area?: string; budget?: string }) => Promise<{ ok: true; customer: { name: string } } | { ok: false; code: string; message?: string }>;
}) {
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(normalizeMobile(customer.phone));
  const [source, setSource] = useState(customer.source ?? "Walk-in");
  const [area, setArea] = useState(customer.area ?? "");
  const [budget, setBudget] = useState(customer.budget ?? BUDGETS[1]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    const input: { name?: string; phone?: string; source?: string; area?: string; budget?: string } = {};
    if (name.trim() && name.trim() !== customer.name) input.name = name.trim();
    if (phone.trim() && normalizeMobile(phone) !== normalizeMobile(customer.phone)) input.phone = phone.trim();
    if (area.trim() !== (customer.area ?? "")) input.area = area.trim();
    if (budget !== (customer.budget ?? "")) input.budget = budget;
    if (source !== (customer.source ?? "Walk-in")) input.source = source;
    if (Object.keys(input).length === 0) {
      onClose();
      return;
    }
    if (input.phone && !isValidMobileIN(input.phone)) {
      setErr("Enter a valid 10-digit mobile number.");
      return;
    }
    setSaving(true);
    const r = await save(customer.id, input);
    setSaving(false);
    if (!r.ok) {
      setErr(r.code === "CUSTOMER_ALREADY_EXISTS"
        ? "That mobile number belongs to another customer. Search it and continue with the existing record."
        : r.code === "FORBIDDEN"
          ? "Only a manager can edit customer records."
          : r.message || "Could not save changes. Try again.");
      return;
    }
    onSaved(r.customer.name);
  };

  return (
    <Drawer
      kicker="Directory"
      title="Edit record"
      onClose={onClose}
      footer={<Btn tone="brand" className="w-full" disabled={saving} onClick={() => void submit()}>{saving ? "Saving…" : "Save changes"}</Btn>}
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Name" htmlFor="edit-name" required>
          <input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus className={inputClass} />
        </Field>
        <Field label="Mobile number" htmlFor="edit-phone" required hint="Changing the mobile merges their lookup identity. Duplicates are blocked.">
          <input id="edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputClass} />
        </Field>
        <Field label="How did you hear about us?" htmlFor="edit-source">
          <select id="edit-source" value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
            {SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Area" htmlFor="edit-area" hint="Neighbourhood — used for the next-season area plan.">
          <input id="edit-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Satellite" autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Budget" htmlFor="edit-budget">
          <select id="edit-budget" value={budget} onChange={(e) => setBudget(e.target.value)} className={inputClass}>
            {BUDGETS.map((b) => <option key={b}>{b}</option>)}
          </select>
        </Field>
        {err && <p role="alert" className="text-[13.5px] font-medium text-[var(--fp-drop)]">{err}</p>}
      </form>
    </Drawer>
  );
}
