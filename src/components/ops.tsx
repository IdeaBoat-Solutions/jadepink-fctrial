"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import type { CustomerSnapshotLive, PastVisitHistoryLive, WhatsAppLogLive } from "@/lib/api";
import { addWhatsAppLog, getCustomerHistory, getWhatsAppLogs, whatsAppLink } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";

/* Shared Stage 2 components over the LIVE visit model (VisitLive /
   CustomerSnapshotLive from the Supabase-backed API).
   Kept exports: CustomerSnapshot + HistoryLayers (also used by the parked
   .route-conflicts route), FCQuickAssign, DeleteVisitButton, EndVisitButton. */

/* ---------- Contact icons: WhatsApp + Call ----------
   wa.me deep-link built from the stored mobile — no Business API wired yet,
   so WhatsApp history below is the manual follow-up log next to this button. */

export function ContactIcons({ phone, name }: { phone: string; name?: string }) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const wa = whatsAppLink(phone, name ? `Hi ${name}, this is JadePink!` : undefined);
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`Contact options`}>
      <a
        href={wa}
        target="_blank"
        rel="noreferrer"
        aria-label={`Chat on WhatsApp`}
        title="Chat on WhatsApp"
        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full border border-[#d9efe2] bg-[#eefaf2] px-2 text-[#177245] hover:border-[#177245]"
      >
        <MessageCircle className="size-4" aria-hidden />
      </a>
      <a
        href={`tel:+91${digits.slice(-10)}`}
        aria-label="Call customer"
        title="Call customer"
        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full border border-[#e8dfd6] bg-white px-2 text-[#57534e] hover:border-[#1c1917] hover:text-[#1c1917]"
      >
        <Phone className="size-4" aria-hidden />
      </a>
    </span>
  );
}

/* ---------- Compact customer snapshot (supporting info, not the task) ---------- */

export function CustomerSnapshot({ customer, compact }: { customer: CustomerSnapshotLive; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[18px] font-semibold tracking-tight text-[#1c1917]">{customer.name}</p>
          <p className="tnum flex items-center gap-2 text-[14px] text-[#57534e]">
            {customer.phone}
            <ContactIcons phone={customer.phone} name={customer.name} />
          </p>
          {(customer.area || customer.budget || customer.source) && (
            <p className="mt-1 text-[12.5px] text-[#78716c]">
              {[customer.area, customer.budget, customer.source ? `via ${customer.source}` : null].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#177245]">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#177245]" />
            {customer.visitCount > 0 ? "Returning customer" : "First visit"}
          </p>
        </div>
        {!compact && (
          <Link href={`/customers/${customer.id}`} className="shrink-0 text-[13.5px] font-semibold text-[var(--staff-brand)] underline-offset-2 hover:underline">
            View history
          </Link>
        )}
      </div>
      {(customer.area || customer.budget || customer.source) && (
        <p className="text-[12.5px] text-[#78716c]">
          {[customer.area, customer.budget, customer.source ? `via ${customer.source}` : null].filter(Boolean).join(" · ")}
        </p>
      )}
      <dl className="grid grid-cols-3 gap-2 border-t border-[#e8dfd6] pt-3">
        <div><dt className="text-[12px] font-medium text-[#78716c]">Visits</dt><dd className="tnum text-[16px] font-semibold">{customer.visitCount}</dd></div>
        <div><dt className="text-[12px] font-medium text-[#78716c]">Purchases</dt><dd className="tnum text-[16px] font-semibold">{customer.purchaseCount}</dd></div>
        <div>
          <dt className="text-[12px] font-medium text-[#78716c]">Last visit</dt>
          <dd className="text-[13.5px] font-semibold">
            {customer.lastVisitAt ? new Date(customer.lastVisitAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "First one"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ---------- Progressive history: L1 snapshot → L2 visits → L3 items ----------
   §35: history is limited — 3 recent visits shown, "Older visits" discloses
   the rest instead of rendering every record at once. */

const HISTORY_PAGE = 3;

export function HistoryLayers({ customerId, phone, name }: { customerId: string; phone?: string; name?: string }) {
  const [history, setHistory] = useState<PastVisitHistoryLive[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(HISTORY_PAGE);
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await getCustomerHistory(customerId);
      if (cancelled) return;
      if (!r.ok) {
        setHistory([]);
        setLoadErr(r.message || "Could not load history.");
        return;
      }
      setHistory(r.data);
      setOpen(r.data[0]?.id ?? null);
      setLoadErr("");
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  if (history === null) {
    return <p className="px-1 py-3 text-[13.5px] text-[#78716c]" aria-busy="true">Loading history…</p>;
  }
  const visible = history.slice(0, limit);
  return (
    <div className="flex flex-col gap-2">
      {phone && (
        <div className="flex items-center justify-between px-1 py-1">
          <span className="text-[12.5px] font-medium text-[#78716c]">Visit history</span>
          <ContactIcons phone={phone} name={name} />
        </div>
      )}
      {loadErr && <p role="alert" className="px-1 text-[13px] font-medium text-[#b4232a]">{loadErr}</p>}
      {history.length === 0 && !loadErr && (
        <p className="px-1 py-3 text-[13.5px] text-[#78716c]">
          No trial history recorded for this customer yet.
        </p>
      )}
      {visible.map((h) => {
        const expanded = open === h.id;
        return (
          <div key={h.id} className="rounded-lg border border-[#e8dfd6]">
            <button
              onClick={() => setOpen(expanded ? null : h.id)}
              aria-expanded={expanded}
              className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left hover:bg-[#faf8f6]"
            >
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-[#1c1917]">{h.dateLabel} <span className="font-normal text-[#78716c]">· FC: {h.fcName}</span></span>
                <span className="tnum block text-[12.5px] text-[#57534e]">
                  Trialled {h.trialled} · Liked {h.liked} · Purchased {h.purchased}
                  {h.budget ? <span className="font-semibold text-[#1c1917]"> · Budget {h.budget}</span> : null}
                </span>
              </span>
              <span aria-hidden className={cn("shrink-0 text-[#78716c] transition-transform", expanded && "rotate-180")}>▾</span>
            </button>
            {expanded && (
              <div className="ui-fade border-t border-[#e8dfd6] bg-[#faf8f6] px-4 py-3">
                {h.items.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {h.items.map((it, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-[13.5px]">
                        <span className="min-w-0 flex-1 basis-32">{it.name} <span className="text-[#78716c]">· {it.size}{it.colour ? ` · ${it.colour}` : ""}</span></span>
                        <StatusBadge value={it.verdict === "rejected" ? "offline" : it.verdict === "purchased" ? "ACTIVE" : "IDENTIFYING"} label={it.verdict} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13.5px] text-[#78716c]">Visit recorded — no products were scanned on the floor.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
      {history.length > visible.length && (
        <button
          onClick={() => setLimit((l) => l + HISTORY_PAGE)}
          className="min-h-[44px] rounded-lg border border-dashed border-[#d6c9bb] text-[13.5px] font-semibold text-[#78716c] hover:border-[#1c1917] hover:text-[#1c1917]"
        >
          Older visits ({history.length - visible.length} more)
        </button>
      )}
    </div>
  );
}

/* ---------- WhatsApp follow-up log (manual, migration 230) ----------
   Sits next to visit history: "Open WhatsApp" deep-links to wa.me, and every
   sent/received message the FC cares about is logged here with one tap. */

const WA_DIRECTIONS = [
  { value: "outgoing", label: "Sent" },
  { value: "incoming", label: "Received" },
  { value: "note", label: "Note" },
] as const;

export function WhatsAppPanel({ customerId, phone, name, visitId }: { customerId: string; phone?: string; name?: string; visitId?: string | null }) {
  const [logs, setLogs] = useState<WhatsAppLogLive[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [body, setBody] = useState("");
  const [direction, setDirection] = useState<WhatsAppLogLive["direction"]>("outgoing");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await getWhatsAppLogs(customerId);
      if (cancelled) return;
      if (!r.ok) {
        setLogs([]);
        setLoadErr(r.message || "Could not load WhatsApp log.");
        return;
      }
      setLogs(r.data);
      setLoadErr("");
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  const save = async () => {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    setSaveErr("");
    const r = await addWhatsAppLog(customerId, { body: text, direction, visitId: visitId ?? null });
    setSaving(false);
    if (!r.ok) {
      setSaveErr(r.message || "Could not save the note.");
      return;
    }
    setLogs((prev) => (prev ? [r.data, ...prev] : [r.data]));
    setBody("");
  };

  if (logs === null) {
    return <p className="px-1 py-3 text-[13.5px] text-[#78716c]" aria-busy="true">Loading WhatsApp log…</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {phone && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#177245]">
            <MessageCircle className="size-4" aria-hidden /> WhatsApp follow-ups
          </span>
          <a
            href={whatsAppLink(phone, name ? `Hi ${name}, this is JadePink!` : undefined)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#1faa55] px-3.5 text-[13px] font-bold text-white hover:bg-[#177245]"
          >
            <MessageCircle className="size-4" aria-hidden /> Open WhatsApp
          </a>
        </div>
      )}
      {loadErr && <p role="alert" className="px-1 text-[13px] font-medium text-[#b4232a]">{loadErr}</p>}
      {logs.length === 0 && !loadErr && (
        <p className="px-1 py-2 text-[13.5px] text-[#78716c]">
          No WhatsApp follow-ups logged yet. Chat on WhatsApp, then log the outcome here.
        </p>
      )}
      {logs.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {logs.map((l) => (
            <li key={l.id} className="rounded-lg border border-[#e8dfd6] bg-[#faf8f6] px-4 py-2.5">
              <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-[#78716c]">
                <span className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-bold",
                  l.direction === "incoming" ? "bg-[#e8f0fe] text-[#1a56db]" : l.direction === "note" ? "bg-[#f1ece4] text-[#57534e]" : "bg-[#d9efe2] text-[#177245]",
                )}>
                  {l.direction === "incoming" ? "Received" : l.direction === "note" ? "Note" : "Sent"}
                </span>
                <span className="tnum">
                  {new Date(l.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-[#1c1917]">{l.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-1 flex flex-col gap-2 rounded-lg border border-[#e8dfd6] p-3"
        onSubmit={(e) => { e.preventDefault(); void save(); }}
      >
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Log type">
          {WA_DIRECTIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              role="radio"
              aria-checked={direction === d.value}
              onClick={() => setDirection(d.value)}
              className={cn(
                "min-h-9 rounded-full border px-3 text-[12.5px] font-semibold",
                direction === d.value
                  ? "border-[#1c1917] bg-[#1c1917] text-white"
                  : "border-[#d6c9bb] text-[#57534e] hover:border-[#1c1917]",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor={`wa-log-${customerId}`}>Log WhatsApp follow-up</label>
        <textarea
          id={`wa-log-${customerId}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="e.g. Sent catalogue on WhatsApp — likes pastel lehengas"
          rows={2}
          maxLength={1000}
          className="w-full rounded-lg border border-[#d6c9bb] bg-white px-3 py-2 text-[14px] text-[#1c1917] placeholder:text-[#a8a29e] focus:border-[#1c1917] focus:outline-none"
        />
        {saveErr && <p role="alert" className="text-[13px] font-medium text-[#b4232a]">{saveErr}</p>}
        <button
          type="submit"
          disabled={!body.trim() || saving}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1c1917] px-4 text-[13.5px] font-bold text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Log follow-up"}
        </button>
      </form>
    </div>
  );
}

/* ---------- History tabs: visits + WhatsApp side by side ---------- */

export function HistoryWithWhatsApp({ customerId, phone, name, visitId }: { customerId: string; phone?: string; name?: string; visitId?: string | null }) {
  const [tab, setTab] = useState<"visits" | "whatsapp">("visits");
  return (
    <div>
      <div className="flex gap-1.5" role="tablist" aria-label="Customer history">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "visits"}
          onClick={() => setTab("visits")}
          className={cn(
            "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13.5px] font-bold",
            tab === "visits" ? "bg-[#1c1917] text-white" : "bg-[#f1ece4] text-[#57534e] hover:bg-[#e7dfd3]",
          )}
        >
          Visit history
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "whatsapp"}
          onClick={() => setTab("whatsapp")}
          className={cn(
            "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13.5px] font-bold",
            tab === "whatsapp" ? "bg-[#1faa55] text-white" : "bg-[#f1ece4] text-[#57534e] hover:bg-[#e7dfd3]",
          )}
        >
          <MessageCircle className="size-4" aria-hidden /> WhatsApp
        </button>
      </div>
      <div className="mt-2" role="tabpanel">
        {tab === "visits"
          ? <HistoryLayers customerId={customerId} phone={phone} name={name} />
          : <WhatsAppPanel customerId={customerId} phone={phone} name={name} visitId={visitId} />}
      </div>
    </div>
  );
}

/* ---------- Inline FC picker: dropdown + tick/cross ----------
   Lives on the live floor so assigning takes seconds. Rendered for every
   signed-in user (FCs and managers alike); the store + API still enforce
   store access and visit-state rules as the final boundary. */

export function FCQuickAssign({ visitId, currentSpId, onAssign }: { visitId: string; currentSpId: string | null; onAssign?: (visitId: string, spId: string) => Promise<void> | void }) {
  const { salespeople, visits, assignSalesperson, pushToast, user } = useStore();
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  // Live load per FC — the same availability rule the assign drawer uses.
  const load = new Map<string, number>();
  for (const v of visits) {
    if (v.assignedSalespersonId && (v.status === "ACTIVE" || v.status === "ASSIGNED")) {
      load.set(v.assignedSalespersonId, (load.get(v.assignedSalespersonId) ?? 0) + 1);
    }
  }
  const pick = async (spId: string) => {
    if (!spId || saving || spId === currentSpId) return;
    setSaving(true);
    if (onAssign) {
      await onAssign(visitId, spId);
    } else {
      const r = await assignSalesperson(visitId, spId);
      const sp = salespeople.find((s) => s.id === spId);
      if (r.ok) pushToast(sp ? `Assigned to ${sp.name}` : "FC assigned", "Floor updated instantly.");
      else pushToast("Could not assign", r.code === "CUSTOMER_REQUIRED" ? "Attach a customer first." : r.message ?? "Try again.");
    }
    setSaving(false);
  };

  /* shadcn Select: once an FC is assigned the trigger shows their name and
     the menu lists only FCs — no "Pick FC…" placeholder row to mis-tap. */
  return (
    <Select value={currentSpId ?? undefined} onValueChange={(spId) => void pick(spId)} disabled={saving}>
      <SelectTrigger
        aria-label="Assign FC"
        className="h-auto min-h-[44px] w-full rounded-lg border-[#d6c9bb] bg-white px-3 py-2 text-[16px] font-medium text-[#1c1917] sm:text-[14px]"
      >
        <SelectValue placeholder={saving ? "Assigning…" : "Pick FC…"} />
      </SelectTrigger>
      <SelectContent>
        {salespeople.map((sp) => {
          const n = load.get(sp.id) ?? 0;
          return (
            <SelectItem key={sp.id} value={sp.id} disabled={!sp.active}>
              {sp.name}{user.id === sp.id ? " (you)" : ""} · {n === 0 ? "Available" : `${n} active`}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/* ---------- Manager-only inline delete ----------
   Two-step confirm, no drawer. The service refuses live, completed, or
   product-bearing visits — that reason surfaces as a toast. On success, the
   store drops the visit and the row unmounts. */
export function DeleteVisitButton({ visitId, name }: { visitId: string; name: string }) {
  const { deleteVisit, pushToast } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    const r = await deleteVisit(visitId);
    setDeleting(false);
    if (!r.ok) {
      setConfirming(false);
      pushToast("Could not delete visit", r.message || "This visit can't be deleted.");
    }
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${name}'s visit`}
        className="inline-flex min-h-11 items-center rounded-lg border border-[#e4c4be] bg-[var(--fp-drop-bg)] px-3 text-[13px] font-semibold text-[var(--fp-drop)] hover:border-[var(--fp-drop)]"
      >
        Delete
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <button onClick={() => void remove()} disabled={deleting} className="inline-flex min-h-11 items-center rounded-lg bg-[var(--fp-drop)] px-3 text-[13px] font-semibold text-white disabled:opacity-50">
        {deleting ? "Deleting…" : "Confirm"}
      </button>
      <button onClick={() => setConfirming(false)} disabled={deleting} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--fp-line-strong)] px-3 text-[13px] font-semibold text-[var(--fp-muted)]">
        Keep
      </button>
    </span>
  );
}

/* ---------- End visit (FC-side cancel) ----------
   Two-step confirm. Any signed-in user on the visit's store may end it — the
   service refuses only when liked/trialled pieces are still unbilled (bill or
   drop them first). On success the store drops the visit and the row unmounts.
   Unlike Delete this keeps the record (CANCELLED) so history stays intact. */
export function EndVisitButton({ visitId, name, className }: { visitId: string; name: string; className?: string }) {
  const { abandonVisit } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);

  const end = async () => {
    if (ending) return;
    setEnding(true);
    await abandonVisit(visitId);
    // Success → store removes the visit (unmount). Failure → toast fired inside
    // the store; keep the confirm open so the reason stays visible.
    setEnding(false);
    setConfirming(false);
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        aria-label={`End ${name}'s visit`}
        className={cn(
          "inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--fp-line-strong)] bg-[var(--fp-surface)] px-4 text-[14px] font-semibold text-[var(--fp-muted)] hover:border-[var(--fp-ink)] hover:text-[var(--fp-ink)]",
          className,
        )}
      >
        End visit
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <button onClick={() => void end()} disabled={ending} className="inline-flex min-h-11 items-center rounded-xl bg-[var(--fp-drop)] px-3.5 text-[13.5px] font-semibold text-white disabled:opacity-50">
        {ending ? "Ending…" : "End without sale"}
      </button>
      <button onClick={() => setConfirming(false)} disabled={ending} className="inline-flex min-h-11 items-center rounded-xl border border-[var(--fp-line-strong)] px-3.5 text-[13.5px] font-semibold text-[var(--fp-muted)]">
        Keep
      </button>
    </span>
  );
}
