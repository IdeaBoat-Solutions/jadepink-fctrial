"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HistoryWithWhatsApp } from "@/components/ops";
import { CUSTOMER_BUDGETS } from "@/features/customers/schemas";
import { FloorBoard, type BoardExternalAction } from "@/components/floor/floor-board";
import { AccessNote, Btn, Drawer, EmptyNote, ErrorNote, Field, inputClass, StatusMark } from "@/components/floor/ui";
import { CustomerCreateForm, type CustomerCreateData } from "@/components/floor/customer-create-form";
import { useStore } from "@/lib/store";
import { useCustomerSearch } from "@/features/customers/use-customer-search";
import { createCustomerSchema } from "@/features/customers/schemas";
import { formatMobileIN, normalizeMobile } from "@/lib/domain";
import { getVisitTimeline, type VisitLive, type VisitTimelineEventLive } from "@/lib/api";
import { canAssignOthers, canReassignVisit } from "@/lib/policy";
import { roundRobinNext } from "@/lib/round-robin";
import { clockTime, formatDateIN } from "@/lib/utils";

function stepOf(visit: VisitLive): number {
  if (visit.status === "COMPLETED" || visit.status === "CANCELLED") return 4;
  if (visit.status === "ACTIVE") return 3;
  if (visit.assignedSalespersonId && visit.customerId) return 2;
  if (visit.customerId) return 1;
  return 0;
}

const STEPS = ["Arrival", "Identify", "Assign", "Floor", "Outcome"];

const SUITE_LABELS_LOCAL: Record<string, string> = {
  SUITE_01: "Suite 01",
  SUITE_02: "Suite 02",
  SUITE_03: "Suite 03",
  SALON_VIP: "Salon VIP",
};

/* Single suite vocabulary everywhere: "Suite 01/02/03 · Salon VIP".
   Matches floor-board SUITES so runners, toasts and header chips agree. */
function FittingRoom({ suite }: { suite: string | null }) {
  if (!suite) return <>No suite assigned</>;
  const label = SUITE_LABELS_LOCAL[suite] ?? suite;
  return <>{label}</>;
}

function humanEvent(type: string): string {
  const known: Record<string, string> = {
    WALK_IN_RECORDED: "Walk-in recorded",
    CUSTOMER_IDENTIFIED: "Customer identified",
    CUSTOMER_ATTACHED: "Customer identified",
    NEW_CUSTOMER_CREATED: "New customer created",
    FC_ASSIGNED: "FC assigned",
    FC_REASSIGNED: "FC reassigned",
    VISIT_STARTED: "Visit started",
    VISIT_COMPLETED: "Visit completed",
    VISIT_CANCELLED: "Visit ended",
    VISIT_ABANDONED: "Visit ended",
    PRODUCT_ADDED: "Product added",
    PRODUCT_REMOVED: "Product removed",
    TRIAL_STARTED: "Trial started",
    TRIAL_COMPLETED: "Trial completed",
    TRIAL_REOPENED: "Trial reopened",
    TRIAL_CANCELLED: "Trial cancelled",
    PRODUCT_LIKED: "Liked",
    PRODUCT_UNLIKED: "Like removed",
    PRODUCT_DROPPED: "Dropped",
    PRODUCT_UNDROPPED: "Drop undone",
    DROP_REASON_CAPTURED: "Drop reason updated",
    PRODUCT_PURCHASED: "Billed",
    BUDGET_CAPTURED: "Budget updated",
    SUITE_ASSIGNED: "Suite assigned",
    RUNNER_REQUESTED: "Runner called",
  };
  return known[type] ?? type.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function VisitWorkspace({ visitId }: { visitId: string }) {
  const store = useStore();
  const cached = store.getVisit(visitId);
  const [remote, setRemote] = useState<VisitLive | null>(null);
  const [missing, setMissing] = useState(false);
  const [checking, setChecking] = useState(!cached);
  const [last, setLast] = useState<VisitLive | null>(null);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/visits/${visitId}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok || !json.data) setMissing(true);
      else setRemote(json.data as VisitLive);
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [cached, visitId]);

  const visit = cached ?? remote;

  /* Pin the last known visit during render (React's endorsed "adjust state
     during render" pattern): a completed visit leaves the store, but the
     screen must show the closed outcome — never a "not found" error. */
  if (visit && visit !== last) setLast(visit);
  const display = visit ?? last;

  if (checking && !display) {
    return (
      <div aria-busy="true" aria-label="Loading visit">
        <div className="fp-skel h-8 w-48" />
        <div className="fp-skel mt-4 h-24" />
      </div>
    );
  }

  if (!visit) {
    if (last) {
      return (
        <div>
          <div className="mt-6 border border-[var(--fp-line)] bg-[var(--fp-surface)] px-5 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fp-faint)]">Outcome</p>
            <h1 className="mt-1 text-[20px] font-semibold">This visit is closed.</h1>
            <p className="mt-2 max-w-[46ch] text-[14.5px] text-[var(--fp-muted)]">The summary was handed to billing. Start a new walk-in if the customer returns.</p>
            <Link href="/today" className="mt-4 inline-flex min-h-11 items-center text-[14px] font-semibold text-[var(--fp-brand)]">Back to dashboard</Link>
          </div>
          <FloorBoard visitId={last.id} readOnly />
        </div>
      );
    }
    return (
      <ErrorNote
        title="This visit is no longer active."
        body="It may have been completed or ended. Go back to today's floor."
        action={<Link href="/today" className="inline-flex min-h-11 items-center text-[14px] font-semibold text-[var(--fp-brand)]">Back to dashboard</Link>}
      />
    );
  }

  if (missing) {
    return (
      <ErrorNote
        title="This visit is no longer active."
        body="It may have been completed or ended. Go back to today's floor."
        action={<Link href="/today" className="inline-flex min-h-11 items-center text-[14px] font-semibold text-[var(--fp-brand)]">Back to dashboard</Link>}
      />
    );
  }

  return <VisitBody visit={visit} />;
}

function VisitBody({ visit }: { visit: VisitLive }) {
  const store = useStore();
  const router = useRouter();
  const customer = visit.customerId ? store.getCustomer(visit.customerId) : undefined;
  const fc = store.salespeople.find((s) => s.id === visit.assignedSalespersonId);
  const step = stepOf(visit);
  const isManager = store.user?.role === "manager";
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [events, setEvents] = useState<VisitTimelineEventLive[] | null>(null);
  const [billing, setBilling] = useState<"idle" | "saving" | "done" | "err">("idle");
  const [handoffErr, setHandoffErr] = useState<string | null>(null);
  /* Header buttons drive the board: each action carries a seq so repeats fire. */
  const [boardAction, setBoardAction] = useState<BoardExternalAction | null>(null);
  const [suiteOverride, setSuiteOverride] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!visit.customerId || customer) return;
    void store.fetchCustomer(visit.customerId);
  }, [visit.customerId, customer, store]);

  /* Elapsed "Active N min" ticks calmly; not tied to data fetching. */
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const fireBoard = (kind: BoardExternalAction["kind"]) =>
    setBoardAction((cur) => ({ seq: (cur?.seq ?? 0) + 1, kind }));

  const suite = suiteOverride ?? visit.suite ?? null;
  const elapsedMin = visit.startedAt ? Math.max(0, Math.floor((now - new Date(visit.startedAt).getTime()) / 60000)) : null;
  const visitCode = `#${visit.id.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}`;
  const storedTier = customer?.tier === "Gold" || customer?.tier === "Silver" ? `${customer.tier} member` : null;
  const tier = storedTier ?? (!customer || customer.visitCount <= 0 ? null : customer.visitCount >= 7 ? "Gold member" : customer.visitCount >= 3 ? "Silver member" : "Member");

  const loadTimeline = async () => {
    setTimelineOpen(true);
    if (events) return;
    const r = await getVisitTimeline(visit.id);
    setEvents(r.ok ? r.data : []);
  };

  const handoff = async () => {
    setBilling("saving");
    setHandoffErr(null);
    const ok = await store.completeVisit(visit.id);
    if (!ok) {
      // Backend guard (VISIT_HAS_UNBILLED_ITEMS): liked/trialled pieces still
      // need a bill number or a drop reason. Store already toasted the count;
      // stay on the floor board so the FC can resolve them.
      setBilling("err");
      setHandoffErr("Some liked or in-trial pieces are still unbilled. Mark each billed — or drop it with a reason — then continue.");
      return;
    }
    setBilling("done");
    store.pushToast("Sent to billing", "The floor visit is closed. The summary stays on the customer.");
  };

  const mine = !visit.assignedSalespersonId || visit.assignedSalespersonId === store.user?.id;
  const blocked = !isManager && visit.status === "ACTIVE" && !mine;
  const isActive = visit.status === "ACTIVE" && billing !== "done";
  const isClosed = visit.status === "COMPLETED" || visit.status === "CANCELLED" || billing === "done";
  /* One status for the whole header — the workspace below always shows the
     matching next step, so the pill and the page can never disagree. */
  const headStatus = !visit.customerId
    ? { mark: "waiting", label: "Needs identification" }
    : !visit.assignedSalespersonId
      ? { mark: "waiting", label: "Needs an FC" }
      : isClosed
        ? { mark: "completed", label: "Closed" }
        : isActive
          ? { mark: "active", label: "On the floor" }
          : { mark: "selected", label: "Ready to start" };

  return (
    <div>
      {/* Wayfinding: never strand an FC mid-fitting — back keeps queue context. */}
      <nav aria-label="Back to floor" className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <Link href={isManager ? "/floor" : "/today"} className="inline-flex min-h-11 items-center gap-1 font-semibold text-[var(--fp-brand)]">
          <span aria-hidden>←</span> {isManager ? "Back to live floor" : "Back to my work"}
        </Link>
        <span aria-hidden className="text-[var(--fp-line-strong)]">·</span>
        <span className="text-[var(--fp-muted)]">Visit {visitCode}</span>
        <span aria-hidden className="text-[var(--fp-line-strong)]">·</span>
        <span className="text-[var(--fp-muted)]">{STEPS[step]}</span>
      </nav>
      {/* Header: who + where in the visit. Product actions only exist while
          the floor board below is live — a pre-identify visit never shows
          dead buttons that tap through to nothing. */}
      <div className="rounded-xl border border-[#e9e2d8] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="break-words text-[26px] font-bold uppercase leading-none tracking-tight text-[#211d18]">
                {customer?.name || visit.customerName || "Unidentified customer"}
              </h1>
              <StatusMark value={headStatus.mark} label={headStatus.label} />
              {tier && customer && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--fp-brand-soft)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--fp-brand)]">
                  <span aria-hidden>◉</span> {tier}
                </span>
              )}
            </div>
            <p className="mt-2 text-[13.5px] text-[#57534e]">
              <strong className="font-semibold text-[#211d18]">{fc?.name ?? "No FC yet"}</strong>
              <span className="mx-2 text-[#cfc6bb]">·</span>
              {visit.startedAt ? `On floor since ${clockTime(visit.startedAt)}` : `Arrived ${clockTime(visit.arrivedAt)}`}
              {elapsedMin !== null && <span className="font-semibold"> ({elapsedMin} min)</span>}
              {suite && (
                <>
                  <span className="mx-2 text-[#cfc6bb]">·</span>
                  <FittingRoom suite={suite} />
                </>
              )}
              <span className="mx-2 text-[#cfc6bb]">·</span>
              <span className="fp-num">{visitCode}</span>
            </p>
          </div>
          {isActive && (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => fireBoard("scan")}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#23403a] px-4 text-[13.5px] font-bold text-white transition-transform hover:bg-[#1a312c] active:scale-[0.98]"
              >
                <span aria-hidden>▮▮▮</span> Scan product
              </button>
              <button
                type="button"
                onClick={() => fireBoard("search")}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#f1ece4] px-4 text-[13.5px] font-bold text-[#211d18] transition-colors hover:bg-[#e7dfd3]"
              >
                <span aria-hidden>＋</span> Add by SKU
              </button>
              <button
                type="button"
                onClick={() => fireBoard("summary")}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-[var(--fp-brand)] px-4 text-[13.5px] font-bold text-white transition-[transform,background-color] hover:bg-[var(--fp-brand-deep)] active:scale-[0.98]"
              >
                Finish & bill →
              </button>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[#f1ece4] pt-3">
          <Btn tone="quiet" onClick={() => void loadTimeline()}>Visit timeline</Btn>
          {isManager && visit.status !== "COMPLETED" && (
            <Btn tone="line" onClick={() => setAssignOpen(true)}>{visit.assignedSalespersonId ? "Reassign FC" : "Assign FC"}</Btn>
          )}
          {isManager && visit.status !== "COMPLETED" && (
            <Btn tone="drop" onClick={() => setDeleteOpen(true)}>Delete visit</Btn>
          )}
        </div>
      </div>

      <ol aria-label="Visit progress" className="mt-5 flex gap-0 overflow-x-auto border-b border-[var(--fp-line)]">
        {STEPS.map((label, i) => (
          <li key={label} className={`flex min-h-10 shrink-0 items-center gap-2 pr-5 text-[12.5px] font-semibold ${i <= step ? "text-[var(--fp-ink)]" : "text-[var(--fp-faint)]"}`}>
            <span aria-hidden className={`size-1.5 ${i === step ? "bg-[var(--fp-brand)]" : i < step ? "bg-[var(--fp-ink)]" : "bg-[var(--fp-line-strong)]"}`} />
            {label}
          </li>
        ))}
      </ol>

      {/* Returning customer → their past history shows on the visit itself,
          not only behind the History button. New customers skip this entirely. */}
      {customer && customer.visitCount > 0 && (
        <PastHistoryPanel
          customerId={customer.id}
          visitCount={customer.visitCount}
          phone={customer.phone}
          name={customer.name}
          visitId={visit.id}
        />
      )}

      {/* Per-visit budget: every new visit gets its own field, prefilled from
          the customer profile but stored on the visit — visit #2 never
          overwrites visit #1. */}
      {customer && !isClosed && (
        <VisitBudgetField
          key={`${visit.id}:${visit.budget ?? ""}:${customer.budget ?? ""}`}
          visitId={visit.id}
          visitBudget={visit.budget ?? null}
          profileBudget={customer.budget ?? null}
          closed={isClosed}
        />
      )}

      {blocked && (
        <div className="mt-5">
          <AccessNote
            headingLevel={2}
            title="This customer is with another salesperson."
            body="You can see your own visits from the dashboard. A manager can reassign if the floor needs it."
            action={<Link href="/today" className="text-[14px] font-semibold text-[var(--fp-brand)]">Back to my work</Link>}
          />
        </div>
      )}

      {!blocked && billing !== "done" && visit.status !== "ACTIVE" && visit.status !== "COMPLETED" && visit.status !== "CANCELLED" && (
        <ArrivalFlow visit={visit} customer={customer} onAssign={() => setAssignOpen(true)} />
      )}

      {!blocked && billing !== "done" && visit.status === "ACTIVE" && (
        <FloorBoard
          visitId={visit.id}
          onHandoff={() => void handoff()}
          externalAction={boardAction}
          onSuiteChange={(s) => setSuiteOverride(s)}
        />
      )}

      {(visit.status === "COMPLETED" || billing === "done") && (
        <>
          <div className="mt-6 border border-[var(--fp-line)] bg-[var(--fp-surface)] px-5 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fp-faint)]">Outcome</p>
            <h2 className="mt-1 text-[20px] font-semibold">This visit is closed.</h2>
            <p className="mt-2 max-w-[46ch] text-[14.5px] text-[var(--fp-muted)]">The summary was handed to billing. Start a new walk-in if the customer returns.</p>
            <Link href="/today" className="mt-4 inline-flex min-h-11 items-center text-[14px] font-semibold text-[var(--fp-brand)]">Back to dashboard</Link>
          </div>
          <FloorBoard visitId={visit.id} readOnly />
        </>
      )}

      {billing === "done" && visit.status !== "COMPLETED" && (
        <p role="status" className="mt-4 text-[14px] font-semibold text-[var(--fp-ok)]">Sent to billing.</p>
      )}

      {assignOpen && (
        <AssignDrawer
          visit={visit}
          onClose={() => setAssignOpen(false)}
        />
      )}

      {deleteOpen && (
        <DeleteVisitDrawer
          visit={visit}
          customerName={customer?.name || visit.customerName}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false);
            store.pushToast("Visit deleted", "The mistaken record is gone.");
            router.push("/today");
          }}
        />
      )}

      {timelineOpen && (
        <Drawer kicker="This visit" title="Timeline" onClose={() => setTimelineOpen(false)}>
          {!events && <div className="fp-skel h-24" aria-busy="true" />}
          {events && events.length === 0 && <EmptyNote title="No events yet." body="Arrival, identification and product steps will appear here." />}
          <ol>
            {events?.map((e) => (
              <li key={e.id} className="border-b border-[var(--fp-line)] py-2.5 text-[14px]">
                <p className="font-medium">{humanEvent(e.type)}</p>
                {e.detail ? <p className="mt-0.5 text-[13px] text-[var(--fp-muted)]">{e.detail}</p> : null}
              </li>
            ))}
          </ol>
        </Drawer>
      )}

      {billing === "saving" && <p className="mt-3 text-[13.5px] font-semibold text-[var(--fp-muted)]">Sending to billing…</p>}
      {billing === "err" && handoffErr && (
        <div className="mt-3">
          <ErrorNote title="Not ready for billing yet." body={handoffErr} />
        </div>
      )}
    </div>
  );
}

function ArrivalFlow({
  visit,
  customer,
  onAssign,
}: {
  visit: VisitLive;
  customer?: { id: string; name: string; phone: string; visitCount: number; purchaseCount: number; lastVisitAt: string | null; area?: string | null; budget?: string | null; source?: string | null };
  onAssign: () => void;
}) {
  const store = useStore();
  const {
    query, setQuery, results, searching, searched, submitted, error,
    search, reset, prefillMobile, prefillName,
  } = useCustomerSearch();
  const showCreateForm = submitted && searched && results.length === 0;

  // Create + attach run through the shared CustomerCreateForm below — this
  // step only owns the submit, not the fields.
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [attaching, setAttaching] = useState(false);
  // Local errors for create/attach/start; search errors come from the hook.
  const [err, setErr] = useState<{ title: string; body: string } | null>(null);

  const fc = store.salespeople.find((s) => s.id === visit.assignedSalespersonId);
  const ready = !!visit.customerId && !!visit.assignedSalespersonId;

  const attach = async (id: string, label: string): Promise<boolean> => {
    setAttaching(true);
    const r = await store.attachCustomerToVisit(visit.id, id);
    setAttaching(false);
    if (!r.ok) {
      setErr({ title: "We couldn't attach this customer.", body: r.message || "Check your connection and try again." });
      return false;
    }
    store.pushToast("Customer attached", label);
    reset();
    return true;
  };

  const create = async (data: CustomerCreateData) => {
    // Single source of truth: the zod schema validates exactly what the
    // server enforces (name needs letters, phone must be a valid IN mobile).
    const parsed = createCustomerSchema.safeParse({
      name: data.name,
      phone: data.phone,
      source: data.source,
      area: data.area.trim() || undefined,
      budget: data.budget || undefined,
    });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Check the name and number and try again.";
      setErr({ title: /mobile|phone/i.test(msg) ? "Enter a valid 10-digit mobile number." : "Name is required.", body: msg });
      return;
    }
    const mobile = parsed.data.phone;
    setSaving(true);
    setErr(null);
    /* One atomic call: the customer is created AND attached to this visit in a
       single transaction. There is no orphaned-record path — either both land
       or neither does. On a duplicate (registered after our search showed "no
       record", or a double tap) resolve the existing record and attach it —
       never strand the FC on a dead-end error mid-visit. */
    const r = await store.createCustomerAndAttach(visit.id, {
      name: parsed.data.name,
      mobile,
      source: parsed.data.source ?? data.source,
      area: parsed.data.area ?? undefined,
      budget: parsed.data.budget ?? undefined,
    });
    setSaving(false);
    const target: { id: string; name: string } | null = r.ok ? r.customer : null;
    if (!r.ok) {
      if (r.code !== "CUSTOMER_ALREADY_EXISTS") {
        setErr({ title: "We couldn't create the customer.", body: r.message || "Check the number and try again." });
        return;
      }
      const found = await store.searchCustomer(mobile);
      if (!found) {
        setErr({ title: "That mobile number is already registered.", body: "Search it above and continue with the existing customer." });
        return;
      }
      const attached = await attach(found.id, found.name);
      if (!attached) return;
    }
    if (!target) return;
    /* No FC picker on the form — identify and assign stay separate steps.
       FCs always serve their own walk-in, so they land on the visit directly;
       managers pick who serves from the roster beside this form. */
    if (store.user && !canAssignOthers(store.user.role)) {
      const a = await store.assignSalesperson(visit.id, store.user.id);
      store.pushToast(
        a.ok ? "You're serving them" : "Customer added",
        a.ok ? `${target.name} is with you — start the visit.` : `${target.name} is on this visit. Pick an FC alongside.`,
      );
      return;
    }
    store.pushToast(r.ok ? "Customer created" : "Existing customer attached", `${target.name} is on this visit. Pick an FC alongside.`);
  };

  const start = async () => {
    setStarting(true);
    const r = await store.startVisit(visit.id);
    setStarting(false);
    if (!r.ok) {
      setErr({ title: "Could not start the visit.", body: r.message || "Assign an FC first, then try again." });
      return;
    }
    store.pushToast("Visit started", "Scan the first product.");
  };

  return (
    <div className="mt-6 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[var(--fp-ok)]">Arrival recorded · {clockTime(visit.arrivedAt)}</p>

        {!visit.customerId && (
          <section className="mt-5" aria-label="Identify customer">
            <h2 className="text-[18px] font-semibold tracking-tight">Who&apos;s visiting?</h2>
            <p className="mt-1 text-[14px] text-[var(--fp-muted)]">Search by name or mobile — known customers come back with their history.</p>
            <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); void search(); }}>
              <Field label="Name or mobile" htmlFor="lookup-q" required>
                <input
                  id="lookup-q"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setErr(null); }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (text && /[0-9]/.test(text)) { e.preventDefault(); setQuery(normalizeMobile(text)); }
                  }}
                  placeholder="Priya Shah, or 98765 43210"
                  autoComplete="off"
                  autoFocus
                  className={inputClass}
                />
              </Field>
              <Btn type="submit" tone="brand" disabled={searching} className="sm:mb-0 sm:min-w-[160px]">
                {searching ? "Searching…" : "Search"}
              </Btn>
            </form>
            <p className="mt-1.5 text-[12.5px] text-[var(--fp-muted)]">Same names are common — every match shows its mobile.</p>
            {(error ?? err) && <div className="mt-4"><ErrorNote title={(error ?? err)!.title} body={(error ?? err)!.body} /></div>}

            {searched && results.length > 0 && (() => {
              /* Same-name rows bifurcate on mobile — count them so ambiguous
                 matches lead with the number instead of the name. */
              const counts = new Map<string, number>();
              for (const c of results) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
              const shared = [...counts.values()].filter((n) => n > 1).length;
              const isShared = (n: string) => (counts.get(n) ?? 0) > 1;
              return (
                <div className="fp-rise mt-5 border border-[var(--fp-line)] bg-[var(--fp-surface)] p-5">
                  <p className="text-[13px] font-semibold text-[var(--fp-muted)]">
                    {results.length} match{results.length > 1 ? "es" : ""}
                    {shared > 0
                      ? ` — ${shared} name${shared > 1 ? "s are" : " is"} shared; the mobile number tells them apart.`
                      : " — confirm the mobile before continuing."}
                  </p>
                  <ul className="mt-2">
                    {results.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fp-line)] py-3 last:border-b-0">
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold">{c.name}</p>
                          <p className={`fp-num text-[13px] ${isShared(c.name) ? "font-semibold text-[var(--fp-ink)]" : "text-[var(--fp-muted)]"}`}>
                            {isShared(c.name) ? `${formatMobileIN(c.phone)} — pick by mobile` : `${formatMobileIN(c.phone)} · ${c.visitCount} visits · ${c.purchaseCount} purchases`}
                          </p>
                          {isShared(c.name) && (
                            <p className="fp-num text-[12.5px] text-[var(--fp-muted)]">{c.visitCount} visits · {c.purchaseCount} purchases</p>
                          )}
                        </div>
                        <Btn tone="brand" disabled={attaching} onClick={() => void attach(c.id, c.name)}>Continue visit</Btn>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {showCreateForm && (
              <CustomerCreateForm
                idPrefix="visit-nc"
                initialName={prefillName}
                initialPhone={prefillMobile}
                contextLine={`No record for “${query.trim()}”. Just the name and number — the rest can wait.`}
                submitLabel="Create & continue"
                saving={saving}
                error={err?.body}
                onSubmit={(data) => void create(data)}
              />
            )}
          </section>
        )}

        {visit.customerId && customer && !ready && (
          <section className="mt-5">
            <Snapshot customer={{ ...customer, phone: customer.phone }} />
            <div className="mt-5 flex flex-wrap gap-2 xl:hidden">
              <Btn tone="brand" onClick={onAssign}>{visit.assignedSalespersonId ? "Continue visit" : "Assign FC"}</Btn>
            </div>
          </section>
        )}

        {ready && (
          <section className="mt-6 max-w-lg border border-[var(--fp-line)] bg-[var(--fp-surface)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fp-faint)]">Visit ready</p>
            <h2 className="fp-name mt-1 text-[28px] leading-none">{customer?.name || visit.customerName}</h2>
            <p className="mt-2 text-[14px] text-[var(--fp-muted)]">{(customer?.visitCount ?? 0) > 0 ? "Returning customer" : "New customer"}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[14px]">
              <div>
                <dt className="text-[12.5px] text-[var(--fp-muted)]">Assigned FC</dt>
                <dd className="font-semibold">{fc?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[12.5px] text-[var(--fp-muted)]">Arrival</dt>
                <dd className="fp-num font-semibold">{clockTime(visit.arrivedAt)}</dd>
              </div>
            </dl>
            {err && <div className="mt-4"><ErrorNote title={err.title} body={err.body} /></div>}
            <Btn tone="brand" className="mt-5 min-w-[180px]" disabled={starting} onClick={() => void start()}>
              {starting ? "Starting…" : "Start visit"}
            </Btn>
          </section>
        )}
      </div>

      <aside className="border-t border-[var(--fp-line)] pt-5 xl:border-t-0 xl:border-l xl:pl-6 xl:pt-0" aria-label="Assignment">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fp-faint)]">This visit</p>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--fp-muted)]">
          {stepOf(visit) === 0 && "Find the customer, then assign who is serving them."}
          {stepOf(visit) === 1 && "Customer is on the visit. Assign an FC before the floor trial."}
          {stepOf(visit) === 2 && "Ready to start. The same visit continues into product trial."}
        </p>
        <div className="mt-5 border-t border-[var(--fp-line)] pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fp-faint)]">Assign Fashion Consultant</p>
          {visit.customerId ? (
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--fp-muted)]">
              {visit.assignedSalespersonId ? "Serving this visit — change only if the floor needs it." : "Pick who leads this fitting."}
            </p>
          ) : null}
          <div className="mt-3">
            <FcRoster visit={visit} locked={!visit.customerId} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function Snapshot({ customer }: { customer: { name: string; phone: string; visitCount: number; purchaseCount: number; lastVisitAt: string | null; area?: string | null; budget?: string | null; source?: string | null } }) {
  const returning = customer.visitCount > 0;
  return (
    <div className="border border-[var(--fp-line)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="fp-name text-[28px] leading-none">{customer.name}</h2>
          <StatusMark value={returning ? "active" : "selected"} label={returning ? "Returning customer" : "New customer"} />
        </div>
      </div>
      <p className="fp-num mt-1.5 px-5 text-[14px] text-[var(--fp-muted)]">{formatMobileIN(customer.phone)}</p>
      {(customer.area || customer.budget || customer.source) && (
        <p className="mt-1.5 px-5 text-[13px] text-[var(--fp-muted)]">
          {[customer.area, customer.budget, customer.source ? `via ${customer.source}` : null].filter(Boolean).join(" · ")}
        </p>
      )}
      <dl className="mx-5 mb-5 mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-[var(--fp-line)] pt-3 text-[14px]">
        <div><dt className="text-[12px] text-[var(--fp-faint)]">Visits</dt><dd className="fp-num text-[18px] font-semibold">{customer.visitCount}</dd></div>
        <div><dt className="text-[12px] text-[var(--fp-faint)]">Purchases</dt><dd className="fp-num text-[18px] font-semibold">{customer.purchaseCount}</dd></div>
        <div><dt className="text-[12px] text-[var(--fp-faint)]">Last visit</dt><dd className="text-[15px] font-semibold">{customer.lastVisitAt ? formatDateIN(customer.lastVisitAt) : "First visit"}</dd></div>
      </dl>
    </div>
  );
}

/* Inline past-history panel for returning customers. Loads the real record
   (visits + trialled/liked/billed items) from the server and defaults open to
   the most recent visit, so an FC sees history without tapping anything.
   Collapsible — today's trial is the task, history is supporting context. */
function PastHistoryPanel({ customerId, visitCount, phone, name, visitId }: { customerId: string; visitCount: number; phone?: string; name?: string; visitId?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="mt-5 rounded-xl border border-[#e9e2d8] bg-white" aria-label="Past visit history">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[52px] w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-left"
      >
        <span>
          <span className="block text-[13px] font-bold uppercase tracking-[0.12em] text-[#57534e]">Past visits + WhatsApp</span>
          <span className="block text-[12.5px] text-[#78716c]">
            Returning customer · {visitCount} previous visit{visitCount > 1 ? "s" : ""} on record
          </span>
        </span>
        <span aria-hidden className={`text-[#78716c] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="border-t border-[#f1ece4] px-5 pb-4 pt-2">
          <HistoryWithWhatsApp customerId={customerId} phone={phone} name={name} visitId={visitId} />
          <Link
            href={`/customers/${customerId}`}
            className="mt-3 inline-flex min-h-11 items-center text-[14px] font-semibold text-[var(--fp-brand)]"
          >
            Open full profile
          </Link>
        </div>
      )}
    </section>
  );
}

/* Per-visit budget field: prefilled from the customer profile, saved onto the
   visit only. Shown on every open visit with a customer — new or returning —
   so the FC captures "today's budget" without touching the profile. */
function VisitBudgetField({ visitId, visitBudget, profileBudget, closed }: { visitId: string; visitBudget: string | null; profileBudget: string | null; closed: boolean }) {
  const store = useStore();
  // Keyed by visit + profile budget above, so the initializer re-runs fresh
  // for every new visit (prefilled from the profile) — no sync effect needed.
  const [value, setValue] = useState(visitBudget ?? profileBudget ?? CUSTOMER_BUDGETS[1]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(visitBudget);
  const [err, setErr] = useState("");

  if (closed) {
    return visitBudget ? (
      <p className="mt-4 text-[13.5px] text-[var(--fp-muted)]">
        This visit budget: <strong className="font-semibold text-[var(--fp-ink)]">{visitBudget}</strong>
      </p>
    ) : null;
  }

  const dirty = value !== (saved ?? profileBudget ?? CUSTOMER_BUDGETS[1]);
  const save = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setErr("");
    const r = await store.setVisitBudget(visitId, value);
    setSaving(false);
    if (!r.ok) {
      setErr(r.message || "Could not save the budget. Try again.");
      return;
    }
    setSaved(value);
    store.pushToast("Visit budget saved", value);
  };

  return (
    <section className="mt-5 rounded-xl border border-[#e9e2d8] bg-white px-5 py-4" aria-label="This visit's budget">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#57534e]">This visit budget</p>
          <p className="mt-0.5 text-[12.5px] text-[#78716c]">
            Separate for every visit{profileBudget ? ` · profile default ${profileBudget}` : " · no profile default yet"}
            {saved ? ` · saved ${saved}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor={`visit-budget-${visitId}`}>This visit budget</label>
        <select
          id={`visit-budget-${visitId}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-[44px] flex-1 rounded-lg border border-[#d6c9bb] bg-white px-3 text-[14px] font-medium text-[#1c1917]"
        >
          {CUSTOMER_BUDGETS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <Btn tone="brand" disabled={!dirty || saving} onClick={() => void save()} className="sm:min-w-[140px]">
          {saving ? "Saving…" : saved ? "Update budget" : "Save budget"}
        </Btn>
      </div>
      {err && <p role="alert" className="mt-2 text-[13px] font-medium text-[var(--fp-drop)]">{err}</p>}
    </section>
  );
}

function AssignDrawer({ visit, onClose }: { visit: VisitLive; onClose: () => void }) {
  const { user } = useStore();
  const manager = canAssignOthers(user?.role);

  return (
    <Drawer kicker="Assignment" title={visit.assignedSalespersonId ? "Reassign FC" : "Assign FC"} onClose={onClose}>
      {!manager && (
        <p className="mb-3 text-[13.5px] text-[var(--fp-muted)]">The whole roster is listed — tap any FC to put them on this visit. Moving a visit that is already with a colleague needs a manager.</p>
      )}
      {manager && (
        <p className="mb-3 text-[13.5px] leading-relaxed text-[var(--fp-muted)]">
          The FC marked Up next is the round-robin turn — fair share across the floor.
          You can still pick anyone; reassigns are logged with who changed it (see Visit timeline).
        </p>
      )}
      <FcRoster visit={visit} onAssigned={() => window.setTimeout(onClose, 500)} />
    </Drawer>
  );
}

/* Manager-only hard delete for a mistaken visit record. Completed visits,
   live visits and visits with products are refused by the server with a
   human reason — the drawer surfaces it without closing. */
function DeleteVisitDrawer({
  visit,
  customerName,
  onClose,
  onDeleted,
}: {
  visit: VisitLive;
  customerName?: string | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { deleteVisit } = useStore();
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");

  const confirm = async () => {
    if (deleting) return;
    setDeleting(true);
    setErr("");
    const r = await deleteVisit(visit.id);
    setDeleting(false);
    if (!r.ok) {
      setErr(r.message || "Could not delete the visit. Try again.");
      return;
    }
    onDeleted();
  };

  return (
    <Drawer
      kicker="Danger zone"
      title="Delete this visit?"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Btn tone="line" className="flex-1" onClick={onClose}>Keep visit</Btn>
          <Btn tone="drop" className="flex-1" disabled={deleting} onClick={() => void confirm()}>
            {deleting ? "Deleting…" : "Yes, delete"}
          </Btn>
        </div>
      }
    >
      <p className="text-[14.5px] leading-relaxed text-[var(--fp-ink)]">
        {customerName ? <><strong className="font-semibold">{customerName}</strong> — </> : null}
        this removes the arrival record permanently. It only works for empty, mistaken arrivals: completed visits, live visits and visits with products are refused automatically.
      </p>
      {err && <p role="alert" className="mt-3 text-[13.5px] font-medium text-[var(--fp-drop)]">{err}</p>}
    </Drawer>
  );
}

/* The assignment rail: same roster the drawer uses, so the arrival terminal
   can show it inline (wide screens) instead of behind a tap. Assignment
   follows round robin — the FC the rotation points at is marked "Up next".
   Every FC on the roster is listed for every role; moving someone else's
   active visit still needs a manager. Locked until a customer is attached —
   the server would reject the pick. */
function FcRoster({ visit, onAssigned, locked }: { visit: VisitLive; onAssigned?: () => void; locked?: boolean }) {
  const { salespeople, visits, assignSalesperson, pushToast, user } = useStore();
  const [saving, setSaving] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(visit.assignedSalespersonId);
  const load = new Map<string, number>();
  visits.forEach((v) => {
    if (v.assignedSalespersonId && (v.status === "ACTIVE" || v.status === "ASSIGNED")) {
      load.set(v.assignedSalespersonId, (load.get(v.assignedSalespersonId) ?? 0) + 1);
    }
  });
  const roster = salespeople;
  /* Round robin picks the suggested assignee: the FC after the most recently
     assigned visit (fewest active load when there is no history). Any FC can
     still be tapped — the mark only keeps walk-ins rotating fairly. */
  const nextUp = roundRobinNext(salespeople, visits);

  const pick = async (id: string, name: string) => {
    if (locked) {
      pushToast("Pick the customer first", "Attach the customer, then choose who serves them.");
      return;
    }
    if (visit.assignedSalespersonId && visit.assignedSalespersonId !== id && !canReassignVisit(user?.role)) {
      const holder = salespeople.find((s) => s.id === visit.assignedSalespersonId)?.name ?? "another FC";
      pushToast("Already with " + holder, "A manager can reassign an active visit.");
      return;
    }
    setSaving(id);
    const r = await assignSalesperson(visit.id, id);
    setSaving(null);
    if (!r.ok) {
      pushToast("Could not assign " + name, r.message || "Try another salesperson.");
      return;
    }
    setDone(id);
    pushToast("Assigned", `${name} is serving this visit.`);
    onAssigned?.();
  };

  return (
    <div>
      {locked && (
        <p className="mb-3 text-[13.5px] leading-relaxed text-[var(--fp-muted)]">Identify the customer first — then every FC below can be picked.</p>
      )}
      {roster.length === 0 && <EmptyNote title="No salesperson is available to assign." body="Ask a manager to activate staff for this store." />}
      <ul className="flex flex-col gap-2" aria-label="Fashion consultants">
        {roster.map((sp) => {
          const n = load.get(sp.id) ?? 0;
          const state = !sp.active ? "offline" : n > 0 ? "busy" : "available";
          const selected = done === sp.id;
          const suggested = nextUp?.id === sp.id && !selected;
          return (
            <li key={sp.id}>
              <button
                onClick={() => void pick(sp.id, sp.name)}
                disabled={saving !== null || state === "offline"}
                className={`flex min-h-[64px] w-full items-center justify-between gap-3 border px-3 text-left ${selected ? "border-[var(--fp-ok)] bg-[var(--fp-ok-bg)]" : suggested ? "border-[#23403a] bg-white hover:border-[#23403a]" : "border-[var(--fp-line)] bg-white hover:border-[var(--fp-ink)]"}`}
              >
                <span>
                  <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                    <span>{sp.name}{sp.id === user?.id ? " (you)" : ""}</span>
                    {suggested && (
                      <span className="rounded-full bg-[#23403a] px-2 py-0.5 text-[11px] font-bold text-white">Up next</span>
                    )}
                  </span>
                  <span className="text-[12.5px] text-[var(--fp-muted)]">
                    {suggested ? "Round-robin turn — fair rotation" : n === 0 ? "No active customers" : `${n} active`}
                  </span>
                </span>
                {saving === sp.id ? <span className="text-[13px] font-semibold">Assigning…</span> : selected ? <span className="text-[13px] font-semibold text-[var(--fp-ok)]">Assigned</span> : <StatusMark value={state} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
