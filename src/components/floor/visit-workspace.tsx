"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FloorBoard, type BoardExternalAction } from "@/components/floor/floor-board";
import { AccessNote, Btn, Drawer, EmptyNote, ErrorNote, Field, inputClass, StatusMark } from "@/components/floor/ui";
import { useStore } from "@/lib/store";
import { FULL_NAME_ERROR, formatMobileIN, isFullName, isValidMobileIN, normalizeMobile, normalizeName } from "@/lib/domain";
import { getVisitTimeline, type CustomerSnapshotLive, type VisitLive, type VisitTimelineEventLive } from "@/lib/api";
import { canAssignOthers, canReassignVisit } from "@/lib/policy";
import { roundRobinNext } from "@/lib/round-robin";
import { clockTime, formatDateIN } from "@/lib/utils";

const SOURCES = ["Walk-in", "Instagram", "Meta Lead", "Referral", "Google", "Friend", "Other"];
const BUDGETS = ["Under ₹5k", "₹5–15k", "₹15–30k", "₹30k+"];

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

/* Header chip reads "Fitting Room 03" for SUITE_03, plain label otherwise. */
function FittingRoom({ suite }: { suite: string | null }) {
  if (!suite) return <>No suite assigned</>;
  const label = SUITE_LABELS_LOCAL[suite] ?? suite;
  const m = label.match(/Suite (\d+)/);
  return <>{m ? `Fitting Room ${m[1]}` : label}</>;
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
    PRODUCT_LIKED: "Liked",
    PRODUCT_DROPPED: "Dropped",
    DROP_REASON_CAPTURED: "Drop reason updated",
    PRODUCT_PURCHASED: "Billed",
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
        <div className="mt-6 border border-[var(--fp-line)] bg-[var(--fp-surface)] px-5 py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fp-faint)]">Outcome</p>
          <h1 className="mt-1 text-[20px] font-semibold">This visit is closed.</h1>
          <p className="mt-2 max-w-[46ch] text-[14.5px] text-[var(--fp-muted)]">The summary was handed to billing. Start a new walk-in if the customer returns.</p>
          <Link href="/today" className="mt-4 inline-flex min-h-11 items-center text-[14px] font-semibold text-[var(--fp-brand)]">Back to dashboard</Link>
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
  const customer = visit.customerId ? store.getCustomer(visit.customerId) : undefined;
  const fc = store.salespeople.find((s) => s.id === visit.assignedSalespersonId);
  const step = stepOf(visit);
  const isManager = store.user?.role === "manager";
  const [assignOpen, setAssignOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
  const tier = !customer || customer.visitCount <= 0 ? null : customer.visitCount >= 7 ? "Gold member" : customer.visitCount >= 3 ? "Silver member" : "Member";

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
      setHandoffErr("Some liked or trialled pieces are still unbilled. Mark each billed — or drop it with a reason — then continue.");
      return;
    }
    setBilling("done");
    store.pushToast("Sent to billing", "The floor visit is closed. The summary stays on the customer.");
  };

  const mine = !visit.assignedSalespersonId || visit.assignedSalespersonId === store.user?.id;
  const blocked = !isManager && visit.status === "ACTIVE" && !mine;

  return (
    <div>
      {/* Ops-console customer header: who, whose customer, how long, where. */}
      <div className="rounded-xl border border-[#e9e2d8] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[26px] font-bold uppercase leading-none tracking-tight text-[#211d18]">
                {customer?.name || visit.customerName || "Unidentified customer"}
              </h1>
              {tier && customer && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f6e9e4] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#b23a48]">
                  <span aria-hidden>◉</span> {tier} · {customer.visitCount} visits
                </span>
              )}
            </div>
            <p className="fp-num mt-2 inline-block rounded bg-[#eef2ee] px-2 py-0.5 text-[12px] font-bold text-[#43544c]">{visitCode}</p>
            <p className="mt-2 text-[13.5px] text-[#57534e]">
              FC: <strong className="font-semibold text-[#211d18]">{fc?.name ?? "Unassigned"}</strong>
              <span className="mx-2 text-[#cfc6bb]">·</span>
              Started {visit.startedAt ? clockTime(visit.startedAt) : clockTime(visit.arrivedAt)}
              {elapsedMin !== null && <span className="font-semibold"> (Active {elapsedMin} min)</span>}
            </p>
            <p className="mt-1.5">
              <span className="inline-block rounded bg-[#f1ece4] px-2 py-1 text-[12px] font-bold text-[#57534e]">
                <FittingRoom suite={suite} />
              </span>
            </p>
          </div>
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
              <span aria-hidden>＋</span> Add SKU
            </button>
            {customer && (
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#f1ece4] px-4 text-[13.5px] font-bold text-[#211d18] transition-colors hover:bg-[#e7dfd3]"
              >
                Customer History
              </button>
            )}
            <button
              type="button"
              onClick={() => fireBoard("summary")}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-[#b23a48] px-4 text-[13.5px] font-bold text-white transition-transform hover:bg-[#9c3340] active:scale-[0.98]"
            >
              Finish & Continue to Billing →
            </button>
          </div>
        </div>
        <div className="mt-3 flex gap-2 border-t border-[#f1ece4] pt-3">
          <Btn tone="quiet" onClick={() => void loadTimeline()}>Visit timeline</Btn>
          {isManager && visit.status !== "COMPLETED" && (
            <Btn tone="line" onClick={() => setAssignOpen(true)}>{visit.assignedSalespersonId ? "Reassign FC" : "Assign FC"}</Btn>
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

      {blocked && (
        <div className="mt-5">
          <AccessNote
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
        <div className="mt-6 border border-[var(--fp-line)] bg-[var(--fp-surface)] px-5 py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fp-faint)]">Outcome</p>
          <h2 className="mt-1 text-[20px] font-semibold">This visit is closed.</h2>
          <p className="mt-2 max-w-[46ch] text-[14.5px] text-[var(--fp-muted)]">The summary was handed to billing. Start a new walk-in if the customer returns.</p>
          <Link href="/today" className="mt-4 inline-flex min-h-11 items-center text-[14px] font-semibold text-[var(--fp-brand)]">Back to dashboard</Link>
        </div>
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

      {historyOpen && customer && (
        <Drawer kicker="History" title={customer.name} onClose={() => setHistoryOpen(false)}>
          <CustomerFacts customer={customer} />
          <PastVisits customerId={customer.id} />
          <Link href={`/customers/${customer.id}`} className="mt-4 inline-flex min-h-11 items-center text-[14px] font-semibold text-[var(--fp-brand)]">
            Open full profile
          </Link>
        </Drawer>
      )}

      {timelineOpen && (
        <Drawer kicker="This visit" title="Timeline" onClose={() => setTimelineOpen(false)}>
          {!events && <div className="fp-skel h-24" aria-busy="true" />}
          {events && events.length === 0 && <EmptyNote title="No events yet." body="Arrival, identification and product steps will appear here." />}
          <ol>
            {events?.map((e) => (
              <li key={e.id} className="grid grid-cols-[72px_1fr] gap-3 border-b border-[var(--fp-line)] py-2.5 text-[14px]">
                <span className="fp-num text-[var(--fp-muted)]">{clockTime(e.at)}</span>
                <span>
                  {humanEvent(e.type)}
                  {e.detail ? <span className="block text-[13px] text-[var(--fp-muted)]">{e.detail}</span> : null}
                </span>
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
  const [mode, setMode] = useState<"mobile" | "name">("mobile");
  const [phone, setPhone] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [nameMatches, setNameMatches] = useState<CustomerSnapshotLive[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [found, setFound] = useState<CustomerSnapshotLive | null>(null);
  const [err, setErr] = useState<{ title: string; body: string } | null>(null);
  const [, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [budget, setBudget] = useState(BUDGETS[1]);
  const [source, setSource] = useState("Walk-in");
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [attaching, setAttaching] = useState(false);

  const digits = normalizeMobile(phone);
  const fc = store.salespeople.find((s) => s.id === visit.assignedSalespersonId);
  const ready = !!visit.customerId && !!visit.assignedSalespersonId;

  const searchMobile = async () => {
    if (!isValidMobileIN(phone)) {
      setErr({ title: "Enter a valid 10-digit mobile number.", body: "Include the number the customer gives you. +91 and spaces are fine." });
      return;
    }
    setSearching(true);
    setErr(null);
    const c = await store.searchCustomer(phone);
    setSearching(false);
    setSearched(true);
    setFound(c);
    if (c) setCreating(false);
    else {
      setCreating(true);
      setName("");
      setArea("");
    }
  };

  const searchByName = async () => {
    const q = nameQuery.trim();
    if (q.length < 2) {
      setErr({ title: "Type at least 2 letters.", body: "Same names are common — you will pick the right person by mobile next." });
      return;
    }
    setSearching(true);
    setErr(null);
    const list = await store.searchCustomersByName(q);
    setSearching(false);
    setSearched(true);
    setNameMatches(list);
    setFound(null);
    if (list.length === 0) {
      setCreating(true);
      setName(q);
    }
  };

  const attach = async (id: string, label: string) => {
    setAttaching(true);
    const r = await store.attachCustomerToVisit(visit.id, id);
    setAttaching(false);
    if (!r.ok) {
      setErr({ title: "We couldn't attach this customer.", body: r.message || "Check your connection and try again." });
      return;
    }
    store.pushToast("Customer attached", label);
    setCreating(false);
  };

  const create = async () => {
    const cleanName = normalizeName(name || nameQuery);
    if (!isFullName(cleanName)) { setErr({ title: "Full name is required.", body: FULL_NAME_ERROR }); return; }
    const mobile = mode === "mobile" ? digits || phone : phone;
    if (!isValidMobileIN(mobile)) { setErr({ title: "Enter a valid 10-digit mobile number.", body: "The number is the lookup key — it must be exact." }); return; }
    setSaving(true);
    setErr(null);
    const r = await store.createCustomer({
      name: cleanName,
      mobile,
      source,
      area: area.trim() || undefined,
      budget: budget || undefined,
    });
    setSaving(false);
    if (!r.ok) {
      setErr(r.code === "DUPLICATE_MOBILE" || r.code === "CUSTOMER_ALREADY_EXISTS"
        ? { title: "That mobile number is already registered.", body: "Search again and continue with the existing customer." }
        : { title: "We couldn't create the customer.", body: r.message || "Check the number and try again." });
      return;
    }
    await attach(r.customer.id, r.customer.name);
    store.pushToast("Customer created", `${r.customer.name} is on this visit.`);
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
    <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <p className="text-[13px] font-semibold text-[var(--fp-ok)]">Arrival recorded · {clockTime(visit.arrivedAt)}</p>

        {!visit.customerId && (
          <section className="mt-5" aria-label="Identify customer">
            <h2 className="text-[18px] font-semibold tracking-tight">Customer looked up on the spot</h2>
            <p className="mt-1 text-[14px] text-[var(--fp-muted)]">Name and mobile number searched against the database. Known customers return with purchase history.</p>
            <div role="tablist" aria-label="Lookup mode" className="mt-4 flex gap-1.5">
              {(["mobile", "name"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  type="button"
                  onClick={() => { setMode(m); setSearched(false); setErr(null); setFound(null); setNameMatches([]); }}
                  className={`min-h-[36px] rounded-full px-4 text-[13px] font-bold ${mode === m ? "bg-[#23403a] text-white" : "bg-[#f1ece4] text-[#57534e]"}`}
                >
                  {m === "mobile" ? "Mobile" : "Name"}
                </button>
              ))}
            </div>
            {mode === "mobile" ? (
              <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); void searchMobile(); }}>
                <Field label="Mobile number" htmlFor="lookup-mobile" required>
                  <div className="flex min-h-11 items-center border border-[var(--fp-line-strong)] bg-[var(--fp-surface)]">
                    <span className="fp-num pl-3 text-[15px] text-[var(--fp-muted)]">+91</span>
                    <input
                      id="lookup-mobile"
                      inputMode="tel"
                      autoComplete="tel"
                      autoFocus
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setSearched(false); setErr(null); }}
                      onPaste={(e) => {
                        const text = e.clipboardData.getData("text");
                        if (text) { e.preventDefault(); setPhone(normalizeMobile(text)); }
                      }}
                      placeholder="98765 43210"
                      className="min-h-11 flex-1 bg-transparent px-2 text-[16px] outline-none"
                    />
                    {phone && (
                      <button type="button" onClick={() => { setPhone(""); setSearched(false); setFound(null); }} className="min-h-11 px-3 text-[13px] font-semibold text-[var(--fp-muted)]">
                        Clear
                      </button>
                    )}
                  </div>
                </Field>
                <Btn type="submit" tone="brand" disabled={searching} className="sm:mb-0 sm:min-w-[160px]">
                  {searching ? "Searching…" : "Search customer"}
                </Btn>
              </form>
            ) : (
              <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); void searchByName(); }}>
                <Field label="Customer name" htmlFor="lookup-name" required hint="Same names are common — pick by mobile on the next step.">
                  <input
                    id="lookup-name"
                    value={nameQuery}
                    onChange={(e) => { setNameQuery(e.target.value); setSearched(false); setErr(null); }}
                    placeholder="e.g. Priya Shah"
                    autoComplete="off"
                    autoFocus
                    className={inputClass}
                  />
                </Field>
                <Btn type="submit" tone="brand" disabled={searching} className="sm:mb-0 sm:min-w-[160px]">
                  {searching ? "Searching…" : "Search by name"}
                </Btn>
              </form>
            )}
            {err && <div className="mt-4"><ErrorNote title={err.title} body={err.body} /></div>}

            {searched && found && mode === "mobile" && (
              <div className="fp-rise mt-5 border border-[var(--fp-line)] bg-[var(--fp-surface)] p-5">
                <Snapshot customer={found} />
                <p className="mt-3 text-[12.5px] text-[var(--fp-muted)]">Prior WhatsApp context appears here once the Stage 1 agent is connected — purchase history above is the source of truth for now.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Btn tone="brand" disabled={attaching} onClick={() => void attach(found.id, found.name)}>
                    {attaching ? "Attaching…" : "Continue visit"}
                  </Btn>
                </div>
              </div>
            )}

            {searched && mode === "name" && nameMatches.length > 0 && (
              <div className="fp-rise mt-5 border border-[var(--fp-line)] bg-[var(--fp-surface)] p-5">
                <p className="text-[13px] font-semibold text-[var(--fp-muted)]">{nameMatches.length} match{nameMatches.length > 1 ? "es" : ""} — confirm the mobile before continuing.</p>
                <ul className="mt-2">
                  {nameMatches.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fp-line)] py-3 last:border-b-0">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold">{c.name}</p>
                        <p className="fp-num text-[13px] text-[var(--fp-muted)]">{formatMobileIN(c.phone)} · {c.visitCount} visits · {c.purchaseCount} purchases</p>
                      </div>
                      <Btn tone="brand" disabled={attaching} onClick={() => void attach(c.id, c.name)}>Continue visit</Btn>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {searched && ((mode === "mobile" && !found) || (mode === "name" && nameMatches.length === 0)) && (
              <form className="fp-rise mt-5 max-w-md" onSubmit={(e) => { e.preventDefault(); void create(); }}>
                <h3 className="text-[16px] font-semibold">New customer captured</h3>
                <p className="mt-1 text-[13.5px] text-[var(--fp-muted)]">
                  {mode === "mobile" ? `No record for ${formatMobileIN(digits)}. ` : `No record for “${nameQuery.trim()}”. `}
                  Name, number, area, budget and how they heard about the store — 30 seconds while they are with you.
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  <Field label="Full name" htmlFor="nc-name" required hint="First name + surname — one name alone mixes two different people up.">
                    <input id="nc-name" value={name || (mode === "name" ? nameQuery : "")} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Shah" className={inputClass} autoFocus />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Mobile" htmlFor="nc-mobile" required>
                      <input
                        id="nc-mobile"
                        value={mode === "mobile" ? formatMobileIN(digits) : phone}
                        onChange={(e) => setPhone(e.target.value)}
                        readOnly={mode === "mobile"}
                        placeholder="+91 98765 43210"
                        inputMode="tel"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Area" htmlFor="nc-area" hint="Neighbourhood — e.g. Satellite, Vastrapur.">
                      <input id="nc-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Satellite" autoComplete="off" className={inputClass} />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Budget" htmlFor="nc-budget">
                      <select id="nc-budget" value={budget} onChange={(e) => setBudget(e.target.value)} className={inputClass}>
                        {BUDGETS.map((b) => <option key={b}>{b}</option>)}
                      </select>
                    </Field>
                    <Field label="How did you hear about us?" htmlFor="nc-source">
                      <select id="nc-source" value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
                        {SOURCES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Btn type="submit" tone="brand" disabled={saving}>{saving ? "Creating…" : "Create customer"}</Btn>
                </div>
              </form>
            )}
          </section>
        )}

        {visit.customerId && customer && !ready && (
          <section className="mt-5">
            <Snapshot customer={{ ...customer, phone: customer.phone }} />
            <div className="mt-5 flex flex-wrap gap-2">
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

      <aside className="border-t border-[var(--fp-line)] pt-4 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fp-faint)]">This visit</p>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--fp-muted)]">
          {stepOf(visit) === 0 && "Find the customer, then assign who is serving them."}
          {stepOf(visit) === 1 && "Customer is on the visit. Assign an FC before the floor trial."}
          {stepOf(visit) === 2 && "Ready to start. The same visit continues into product trial."}
        </p>
      </aside>
    </div>
  );
}

function Snapshot({ customer }: { customer: { name: string; phone: string; visitCount: number; purchaseCount: number; lastVisitAt: string | null; area?: string | null; budget?: string | null; source?: string | null } }) {
  const returning = customer.visitCount > 0;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="fp-name text-[28px] leading-none">{customer.name}</h2>
        <StatusMark value={returning ? "active" : "selected"} label={returning ? "Returning customer" : "New customer"} />
      </div>
      <p className="fp-num mt-2 text-[14px] text-[var(--fp-muted)]">{formatMobileIN(customer.phone)}</p>
      {(customer.area || customer.budget || customer.source) && (
        <p className="mt-1.5 text-[13px] text-[var(--fp-muted)]">
          {[customer.area, customer.budget, customer.source ? `via ${customer.source}` : null].filter(Boolean).join(" · ")}
        </p>
      )}
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[14px]">
        <div><dt className="text-[12px] text-[var(--fp-faint)]">Visits</dt><dd className="fp-num font-semibold">{customer.visitCount}</dd></div>
        <div><dt className="text-[12px] text-[var(--fp-faint)]">Purchases</dt><dd className="fp-num font-semibold">{customer.purchaseCount}</dd></div>
        <div><dt className="text-[12px] text-[var(--fp-faint)]">Last visit</dt><dd className="font-semibold">{customer.lastVisitAt ? formatDateIN(customer.lastVisitAt) : "First visit"}</dd></div>
      </dl>
    </div>
  );
}

function CustomerFacts({ customer }: { customer: { visitCount: number; purchaseCount: number; lastVisitAt: string | null; phone: string } }) {
  return (
    <dl className="grid grid-cols-3 gap-3 border-b border-[var(--fp-line)] pb-4 text-[14px]">
      <div><dt className="text-[12px] text-[var(--fp-faint)]">Visits</dt><dd className="fp-num text-[20px] font-semibold">{customer.visitCount}</dd></div>
      <div><dt className="text-[12px] text-[var(--fp-faint)]">Purchases</dt><dd className="fp-num text-[20px] font-semibold">{customer.purchaseCount}</dd></div>
      <div><dt className="text-[12px] text-[var(--fp-faint)]">Last</dt><dd className="text-[14px] font-semibold">{customer.lastVisitAt ? formatDateIN(customer.lastVisitAt) : "—"}</dd></div>
    </dl>
  );
}

function PastVisits({ customerId }: { customerId: string }) {
  const { visits } = useStore();
  const rows = useMemo(
    () => visits.filter((v) => v.customerId === customerId).sort((a, b) => +new Date(b.arrivedAt) - +new Date(a.arrivedAt)),
    [visits, customerId],
  );
  if (rows.length === 0) {
    return <EmptyNote title="No previous visits recorded." body="Today's visit will be the start of their history." />;
  }
  return (
    <ul className="mt-3">
      {rows.map((v) => (
        <li key={v.id} className="border-b border-[var(--fp-line)] py-3 text-[14px]">
          <p className="font-semibold">{formatDateIN(v.arrivedAt) || clockTime(v.arrivedAt)}</p>
          <p className="text-[13px] text-[var(--fp-muted)]">{v.fcName || "FC unassigned"} · {v.status === "ACTIVE" ? "On the floor now" : v.status === "COMPLETED" ? "Completed" : "In progress"}</p>
        </li>
      ))}
    </ul>
  );
}

function AssignDrawer({ visit, onClose }: { visit: VisitLive; onClose: () => void }) {
  const { salespeople, visits, assignSalesperson, pushToast, user } = useStore();
  const [saving, setSaving] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(visit.assignedSalespersonId);
  const manager = canAssignOthers(user?.role);
  const load = new Map<string, number>();
  visits.forEach((v) => {
    if (v.assignedSalespersonId && (v.status === "ACTIVE" || v.status === "ASSIGNED")) {
      load.set(v.assignedSalespersonId, (load.get(v.assignedSalespersonId) ?? 0) + 1);
    }
  });
  const roster = manager ? salespeople : salespeople.filter((s) => s.id === user?.id);

  const pick = async (id: string, name: string) => {
    if (visit.assignedSalespersonId && visit.assignedSalespersonId !== id && !canReassignVisit(user?.role)) return;
    setSaving(id);
    const r = await assignSalesperson(visit.id, id);
    setSaving(null);
    if (!r.ok) {
      pushToast(r.code === "CUSTOMER_REQUIRED" ? "Attach a customer first." : "FC unavailable", r.message || "Try another salesperson.");
      return;
    }
    setDone(id);
    pushToast("Assigned", name);
    window.setTimeout(onClose, 500);
  };

  return (
    <Drawer kicker="Assignment · round robin" title={visit.assignedSalespersonId ? "Reassign FC" : "Assign FC — round robin"} onClose={onClose}>
      {!manager && (
        <p className="mb-3 text-[13.5px] text-[var(--fp-muted)]">You can take this customer yourself. A manager assigns anyone else.</p>
      )}
      {manager && (
        <p className="mb-3 text-[13.5px] leading-relaxed text-[var(--fp-muted)]">
          Walk-ins rotate in roster order — fair share across the floor. You can reassign any walk-in;
          the override is logged with who changed it (see Visit timeline).
        </p>
      )}
      {roster.length === 0 && <EmptyNote title="No salesperson is available to assign." body="Ask a manager to activate staff for this store." />}
      {(() => {
        const next = roundRobinNext(salespeople, visits);
        if (!next || !manager) return null;
        const isCurrent = visit.assignedSalespersonId === next.id;
        return (
          <button
            type="button"
            disabled={saving !== null || isCurrent}
            onClick={() => void pick(next.id, next.name)}
            className="mb-3 flex min-h-[52px] w-full items-center justify-between gap-3 rounded-lg bg-[#23403a] px-4 text-left text-white"
          >
            <span className="text-[14px] font-bold">
              {isCurrent ? `Round robin — ${next.name} is already on this visit` : `Round robin — next up: ${next.name} →`}
            </span>
            {saving === next.id && <span className="text-[12.5px]">Assigning…</span>}
          </button>
        );
      })()}
      <ul className="flex flex-col gap-2">
        {roster.map((sp) => {
          const n = load.get(sp.id) ?? 0;
          const state = !sp.active ? "offline" : n > 0 ? "busy" : "available";
          const selected = done === sp.id;
          return (
            <li key={sp.id}>
              <button
                onClick={() => void pick(sp.id, sp.name)}
                disabled={saving !== null || state === "offline"}
                className={`flex min-h-[64px] w-full items-center justify-between gap-3 border px-3 text-left ${selected ? "border-[var(--fp-ok)] bg-[var(--fp-ok-bg)]" : "border-[var(--fp-line)] bg-white hover:border-[var(--fp-ink)]"}`}
              >
                <span>
                  <span className="block text-[15px] font-semibold">{sp.name}{sp.id === user?.id ? " (you)" : ""}</span>
                  <span className="text-[12.5px] text-[var(--fp-muted)]">{n === 0 ? "No active customers" : `${n} active`}</span>
                </span>
                {saving === sp.id ? <span className="text-[13px] font-semibold">Assigning…</span> : selected ? <span className="text-[13px] font-semibold text-[var(--fp-ok)]">Assigned</span> : <StatusMark value={state} />}
              </button>
            </li>
          );
        })}
      </ul>
    </Drawer>
  );
}
