"use client";

/* JadePink F.C. Trial — Stage 3 floor UI.
   Product selection → trial → liked / dropped, on one active visit.
   Talks to the Stage 3 API (single source of truth: Supabase).

   Design: the Stage 2 ops system — paper #faf8f6, ink #1c1917, brand #8e3a4e (var(--staff-brand)),
   44px+ touch targets, tnum numerals. Status is never colour-alone (label + dot). */

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  GhostButton,
  Panel,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  StatusBadge,
  TextInput,
} from "@/components/ui";
import { useStore } from "@/lib/store";
import type { ProductCardDTO, VisitWithProductsDTO } from "@/features/visits/products/dto";
import { productStatusLabel } from "@/features/visits/products/state-machine";
import { useVisitProductsRealtime } from "@/features/visits/products/use-visit-products-realtime";
import type { ProductVisitStatus } from "@/features/visits/products/types";

type DropReason = VisitWithProductsDTO["dropReasons"][number];

type ScanResult = {
  product: {
    id: string;
    sku: string;
    barcode: string | null;
    product: { id: string; name: string; category: string };
    size: string;
    colour: string;
    price: number;
    imageUrl: string | null;
  };
  alreadyAdded: boolean;
  visitProductId: string | null;
};

type SearchCandidate = {
  id: string;
  sku: string;
  barcode: string | null;
  product: { id: string; name: string; category: string };
  size: string;
  colour: string;
  price: number;
  imageUrl: string | null;
  alreadyAdded: boolean;
  visitProductId: string | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; code: string; message: string }
  | { status: "ready"; data: VisitWithProductsDTO };

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const STATUS_META: Record<ProductVisitStatus, { cls: string; dot: string }> = {
  SELECTED: { cls: "bg-[#f3eeea] text-[#57534e] border-[#e8dfd6]", dot: "bg-[#a8a29e]" },
  TRIAL_IN_PROGRESS: { cls: "bg-[#fdf1d7] text-[#9a5b00] border-[#f0d48a]", dot: "bg-[#9a5b00]" },
  TRIAL_COMPLETED: { cls: "bg-[#edf1f6] text-[#44566c] border-[#cbd5e1]", dot: "bg-[#44566c]" },
  LIKED: { cls: "bg-[#e6f4ec] text-[#177245] border-[#bfe3cd]", dot: "bg-[#177245]" },
  DROPPED: { cls: "bg-[#fdecec] text-[#7d1a1f] border-[#f0b6b9]", dot: "bg-[#b4232a]" },
  PURCHASED: { cls: "bg-[#fbe9ef] text-[#8f1b3d] border-[#eec2cf]", dot: "bg-[var(--staff-brand)]" },
};

function ProductStatusBadge({ status }: { status: ProductVisitStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex min-h-[26px] items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold tracking-wide ${meta.cls}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {productStatusLabel(status)}
    </span>
  );
}

function friendly(code: string, message: string): { title: string; body: string } {
  switch (code) {
    case "PRODUCT_NOT_FOUND":
      return { title: "No exact barcode or SKU found.", body: "Check the code — or pick from the name matches below." };
    case "PRODUCT_ALREADY_ADDED":
      return { title: "Already on this visit.", body: message || "The product is already in this visit." };
    case "INVALID_PRODUCT_STATE":
      return { title: "That step isn’t available.", body: message || "The product is in a different state. Refresh and try again." };
    case "PRODUCT_STATE_CHANGED":
      return { title: "Someone else changed this product.", body: message || "The board has been refreshed — check the latest state." };
    case "DROP_REASON_REQUIRED":
      return { title: "Choose a reason.", body: "A dropped product always needs a reason." };
    case "VISIT_NOT_ACTIVE":
      return { title: "This visit isn’t active.", body: "Start the visit before working the floor trial." };
    case "VISIT_ALREADY_COMPLETED":
      return { title: "This visit is closed.", body: "Completed visits can’t be changed." };
    case "UNAUTHORIZED":
      return { title: "Sign in required.", body: "Your session expired. Sign in again to continue." };
    case "FORBIDDEN":
      return { title: "Not your store.", body: "Your account can’t work this store’s visit." };
    default:
      return { title: "That didn’t save.", body: message || "Try again once — your input is preserved." };
  }
}

/** API failure carrying a stable domain code. */
class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function callApi(visitId: string, action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch(`/api/visits/${visitId}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.code ?? "INTERNAL", json.message ?? "Request failed");
  return json.data;
}

/** Read the visit board. Pure fetch → LoadState; never touches React state. */
async function fetchVisit(visitId: string): Promise<LoadState> {
  try {
    const res = await fetch(`/api/visits/${visitId}/products`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: "error", code: json.code ?? "INTERNAL", message: json.message ?? "Could not load visit" };
    }
    return { status: "ready", data: json.data as VisitWithProductsDTO };
  } catch {
    return { status: "error", code: "OFFLINE", message: "Connection lost" };
  }
}

/* ---------- Main flow ---------- */

export function Stage3TrialFlow({ visitId }: { visitId: string }) {
  const { pushToast } = useStore();

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ title: string; body: string } | null>(null);

  const [identifier, setIdentifier] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [searchResults, setSearchResults] = useState<SearchCandidate[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [dropFor, setDropFor] = useState<ProductCardDTO | null>(null);
  const [dropReasonId, setDropReasonId] = useState<string>("");
  const [dropNote, setDropNote] = useState("");
  const [removeFor, setRemoveFor] = useState<ProductCardDTO | null>(null);

  const scanRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setState(await fetchVisit(visitId));
  }, [visitId]);

  // Live updates for this visit (§32–33). Coalesced; no-op when unconfigured.
  const live = useVisitProductsRealtime(visitId, refresh);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchVisit(visitId);
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>, success?: { title: string; body?: string }) => {
      setBusy(key);
      setErr(null);
      try {
        await fn();
        await refresh();
        if (success) pushToast(success.title, success.body);
      } catch (e) {
        const code = e instanceof ApiError ? e.code : "INTERNAL";
        const message = e instanceof Error ? e.message : "";
        setErr(friendly(code, message));
      } finally {
        setBusy(null);
      }
    },
    [refresh, pushToast],
  );

  const doScan = useCallback(async () => {
    const value = identifier.trim();
    if (!value) return;
    setScanning(true);
    setErr(null);
    setScanResult(null);
    setSearchResults(null);
    setSearchQuery("");
    try {
      // Exact path first: barcode, then SKU. Unchanged and fast.
      const data = (await callApi(visitId, "scan", { identifier: value })) as ScanResult;
      setScanResult(data);
      if (data.alreadyAdded) {
        pushToast("Already on this visit", `${data.product.product.name} · ${data.product.sku}`);
      }
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "INTERNAL";
      // Miss on exact code + enough characters → fall back to name search
      // so the FC can type "floral" and pick the right variant.
      if (code === "PRODUCT_NOT_FOUND" && value.length >= 2) {
        try {
          const found = (await callApi(visitId, "search", { query: value })) as { results: SearchCandidate[] };
          if (found.results.length > 0) {
            setSearchResults(found.results);
            setSearchQuery(value);
            return;
          }
        } catch {
          /* fall through to the not-found message */
        }
      }
      setErr(friendly(code, e instanceof Error ? e.message : ""));
    } finally {
      setScanning(false);
    }
  }, [identifier, pushToast, visitId]);

  const addScanned = useCallback(() => {
    if (!scanResult) return;
    const name = scanResult.product.product.name;
    void run(
      `add-${scanResult.product.id}`,
      async () => {
        await callApi(visitId, "add", { productVariantId: scanResult.product.id });
        setScanResult(null);
        setIdentifier("");
        scanRef.current?.focus();
      },
      { title: "Added to visit", body: name },
    );
  }, [run, scanResult, visitId]);

  const addCandidate = useCallback((c: SearchCandidate) => {
    if (c.alreadyAdded) {
      pushToast("Already on this visit", `${c.product.name} · ${c.sku}`);
      return;
    }
    void run(
      `add-${c.id}`,
      async () => {
        await callApi(visitId, "add", { productVariantId: c.id });
        setSearchResults(null);
        setSearchQuery("");
        setIdentifier("");
        scanRef.current?.focus();
      },
      { title: "Added to visit", body: c.product.name },
    );
  }, [run, pushToast, visitId]);

  const openDrop = (card: ProductCardDTO) => {
    setDropReasonId("");
    setDropNote("");
    setDropFor(card);
  };

  const confirmDrop = () => {
    if (!dropFor || !dropReasonId) return;
    const card = dropFor;
    const reasonLabel = (state.status === "ready" ? state.data.dropReasons.find((r) => r.id === dropReasonId)?.label : "") ?? "";
    void run(
      `drop-${card.id}`,
      async () => {
        await callApi(visitId, "drop", { visitProductId: card.id, dropReasonId, note: dropNote || undefined });
        setDropFor(null);
      },
      { title: "Dropped", body: `${card.product.name}${reasonLabel ? ` — ${reasonLabel}` : ""}` },
    );
  };

  const groups = useMemo(() => {
    if (state.status !== "ready") return null;
    const by = (s: ProductVisitStatus) => state.data.products.filter((p) => p.status === s);
    return {
      awaiting: by("TRIAL_COMPLETED"),
      trialling: by("TRIAL_IN_PROGRESS"),
      selected: by("SELECTED"),
      liked: by("LIKED"),
      dropped: by("DROPPED"),
      purchased: by("PURCHASED"),
    };
  }, [state]);

  /* ---------- states ---------- */

  if (state.status === "loading") {
    return (
      <div className="staff-page" aria-busy="true" aria-label="Loading floor trial">
        <div className="skeleton-soft h-[104px] rounded-2xl" />
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-soft h-[168px] rounded-2xl" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    const f = friendly(state.code, state.message);
    if (state.code === "VISIT_NOT_FOUND") {
      return (
        <Panel className="p-5">
          <EmptyState
            title="This visit isn’t on the floor yet."
            body="Floor trial runs on an active visit. In demo mode the local walk-in isn’t in the backend — open an active visit to start scanning."
          />
        </Panel>
      );
    }
    return (
      <Panel className="p-5">
        <ErrorBlock title={f.title} body={f.body} />
        <div className="mt-3">
          <SecondaryButton onClick={() => { setState({ status: "loading" }); void refresh(); }}>Retry</SecondaryButton>
        </div>
      </Panel>
    );
  }

  const { data } = state;

  return (
    <div className="staff-page">
      {/* Visit header */}
      <Panel className="p-5 sm:p-6">
        <SectionTitle
          kicker="On the floor"
          title={data.visit.customerName || "Active visit"}
          aside={
            <div className="flex items-center gap-2">
              {live && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bfe3cd] bg-[#e6f4ec] px-2.5 py-1 text-[12px] font-semibold text-[#177245]">
                  <span aria-hidden className="live-dot inline-block size-1.5 rounded-full bg-[#177245] text-[#177245]" />
                  Live
                </span>
              )}
              <StatusBadge value={data.visit.status} />
            </div>
          }
        />
        <dl className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Trial summary">
          {[
            { label: "Selected", value: data.summary.selected },
            { label: "In trial", value: data.summary.trialInProgress },
            { label: "Awaiting", value: data.summary.trialCompleted },
            { label: "Liked", value: data.summary.liked, hot: data.summary.liked > 0 },
            { label: "Dropped", value: data.summary.dropped },
            { label: "Purchased", value: data.summary.purchased, hot: data.summary.purchased > 0 },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border px-3 py-2.5 transition-colors ${"hot" in s && s.hot ? "border-[#bfe3cd] bg-[#f2faf5]" : "border-[#e8dfd6] bg-[#faf8f6]"}`}>
              <dd key={s.value} className="count-pop tnum text-[22px] font-semibold leading-none tracking-tight text-[#1c1917]">{s.value}</dd>
              <dt className="mt-1 text-[12px] font-medium text-[#78716c]">{s.label}</dt>
            </div>
          ))}
        </dl>
      </Panel>

      {err && <ErrorBlock title={err.title} body={err.body} actionLabel="Dismiss" onAction={() => setErr(null)} />}

      {/* Scan / search / add */}
      <Panel className="p-5 sm:p-6">
        <SectionTitle kicker="Scan or search" title="Add a product to this visit" />
        <form className="mt-3.5 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void doScan(); }}>
          <div className="relative flex-1">
            <TextInput
              ref={scanRef}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Scan barcode, SKU or product name…"
              aria-label="Product barcode, SKU or name"
              autoComplete="off"
              enterKeyHint="search"
              className="flex-1 py-3 pl-11"
            />
            <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a8a29e]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M3 12h18" /></svg>
            </span>
          </div>
          <PrimaryButton type="submit" disabled={scanning || !identifier.trim()} className="sm:w-44">
            {scanning ? "Looking up…" : "Scan →"}
          </PrimaryButton>
        </form>

        {scanResult && (
          <div className="ui-fade mt-3 flex flex-col gap-3 rounded-2xl border border-[#e8dfd6] bg-[#faf8f6] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <ProductThumb name={scanResult.product.product.name} imageUrl={scanResult.product.imageUrl} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold tracking-tight text-[#1c1917]">{scanResult.product.product.name}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-[#78716c]">
                  {scanResult.product.product.category || "—"} · {scanResult.product.colour} · {scanResult.product.size} ·{" "}
                  <span className="tnum font-semibold text-[#1c1917]">{INR.format(scanResult.product.price)}</span>
                </p>
                <p className="mt-0.5 font-mono text-[12px] text-[#76716b]">{scanResult.product.sku}</p>
              </div>
            </div>
            {scanResult.alreadyAdded ? (
              <span className="inline-flex min-h-[44px] items-center gap-1.5 text-[13.5px] font-semibold text-[#9a5b00]"><span aria-hidden className="grid size-5 place-items-center rounded-full bg-[#fdf1d7] ring-1 ring-[#f0d48a]">!</span>Already on this visit</span>
            ) : (
              <PrimaryButton onClick={addScanned} disabled={busy === `add-${scanResult.product.id}`} className="sm:w-44">
                {busy === `add-${scanResult.product.id}` ? "Adding…" : "Add to visit →"}
              </PrimaryButton>
            )}
          </div>
        )}

        {searchResults && (
          <div className="ui-fade mt-3 flex flex-col gap-2" role="listbox" aria-label={`Name matches for ${searchQuery}`}>
            <p className="text-[13px] font-medium text-[#78716c]">
              No exact code match — {searchResults.length} name match{searchResults.length > 1 ? "es" : ""} for <strong className="font-semibold text-[#1c1917]">“{searchQuery}”</strong>. Pick the right size / colour:
            </p>
            {searchResults.map((c) => (
              <div key={c.id} role="option" aria-selected="false" className="flex flex-col gap-3 rounded-2xl border border-[#e8dfd6] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <ProductThumb name={c.product.name} imageUrl={c.imageUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold tracking-tight text-[#1c1917]">{c.product.name}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-[#78716c]">
                      {c.product.category || "—"} · {c.colour} · {c.size} ·{" "}
                      <span className="tnum font-semibold text-[#1c1917]">{INR.format(c.price)}</span>
                    </p>
                    <p className="mt-0.5 font-mono text-[12px] text-[#76716b]">{c.sku}</p>
                  </div>
                </div>
                {c.alreadyAdded ? (
                  <span className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 text-[13.5px] font-semibold text-[#9a5b00]"><span aria-hidden className="grid size-5 place-items-center rounded-full bg-[#fdf1d7] ring-1 ring-[#f0d48a]">!</span>Already added</span>
                ) : (
                  <PrimaryButton onClick={() => addCandidate(c)} disabled={busy === `add-${c.id}`} className="sm:w-40">
                    {busy === `add-${c.id}` ? "Adding…" : "Add →"}
                  </PrimaryButton>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Awaiting verdict */}
      {groups && groups.awaiting.length > 0 && (
        <Panel className="border-[#f0d48a] bg-[#fffdf5] p-5 sm:p-6">
          <SectionTitle kicker="Needs a verdict" title={`${groups.awaiting.length} product${groups.awaiting.length > 1 ? "s" : ""} trialled`} />
          <div className="mt-3.5 flex flex-col gap-2.5">
            {groups.awaiting.map((card) => (
              <ProductRow key={card.id} card={card}>
                <SecondaryButton
                  onClick={() => run(`like-${card.id}`, () => callApi(visitId, "like", { visitProductId: card.id }), { title: "Liked", body: card.product.name })}
                  disabled={busy === `like-${card.id}`}
                  className="min-h-[48px] flex-1 border-[#bfe3cd] bg-[#f2faf5] text-[#177245] hover:border-[#177245] hover:bg-[#e6f4ec] hover:text-[#177245]"
                >
                  {busy === `like-${card.id}` ? "Saving…" : "♥ Liked"}
                </SecondaryButton>
                <SecondaryButton
                  onClick={() => openDrop(card)}
                  disabled={busy === `drop-${card.id}`}
                  className="min-h-[48px] flex-1 border-[#f0b6b9] text-[#7d1a1f] hover:border-[#b4232a] hover:bg-[#fdecec] hover:text-[#7d1a1f]"
                >
                  Drop
                </SecondaryButton>
              </ProductRow>
            ))}
          </div>
        </Panel>
      )}

      {/* In trial */}
      {groups && groups.trialling.length > 0 && (
        <Panel className="p-5 sm:p-6">
          <SectionTitle kicker="On trial" title="In the trial room" />
          <div className="mt-3.5 flex flex-col gap-2.5">
            {groups.trialling.map((card) => (
              <ProductRow key={card.id} card={card}>
                <PrimaryButton
                  onClick={() => run(`complete-${card.id}`, () => callApi(visitId, "complete-trial", { visitProductId: card.id }), { title: "Trial complete", body: `${card.product.name} — decide liked or dropped` })}
                  disabled={busy === `complete-${card.id}`}
                  className="min-h-[48px]"
                >
                  {busy === `complete-${card.id}` ? "Saving…" : "Trial complete →"}
                </PrimaryButton>
              </ProductRow>
            ))}
          </div>
        </Panel>
      )}

      {/* Selected */}
      {groups && groups.selected.length > 0 && (
        <Panel className="p-5 sm:p-6">
          <SectionTitle kicker="Shortlisted" title="Selected, not yet trialled" />
          <div className="mt-3.5 flex flex-col gap-2.5">
            {groups.selected.map((card) => (
              <ProductRow key={card.id} card={card}>
                <PrimaryButton
                  onClick={() => run(`start-${card.id}`, () => callApi(visitId, "start-trial", { visitProductId: card.id }), { title: "Trial started", body: card.product.name })}
                  disabled={busy === `start-${card.id}`}
                  className="min-h-[48px]"
                >
                  {busy === `start-${card.id}` ? "Saving…" : "Start trial →"}
                </PrimaryButton>
                <GhostButton onClick={() => setRemoveFor(card)} disabled={busy === `remove-${card.id}`}>
                  Remove
                </GhostButton>
              </ProductRow>
            ))}
          </div>
        </Panel>
      )}

      {/* Verdicts */}
      {groups && (groups.liked.length > 0 || groups.dropped.length > 0 || groups.purchased.length > 0) && (
        <Panel className="p-5 sm:p-6">
          <SectionTitle kicker="Verdicts" title="Liked & dropped" />
          <div className="mt-3.5 flex flex-col gap-2.5">
            {[...groups.liked, ...groups.purchased, ...groups.dropped].map((card) => (
              <ProductRow key={card.id} card={card} muted />
            ))}
          </div>
        </Panel>
      )}

      {data.products.length === 0 && (
        <Panel className="p-5 sm:p-6">
          <EmptyState title="Nothing scanned yet." body="Scan a barcode, enter a SKU, or type a product name to start the trial for this visit." />
        </Panel>
      )}

      {/* Drop reason dialog */}
      {dropFor && (
        <DropReasonDialog
          card={dropFor}
          reasons={data.dropReasons}
          reasonId={dropReasonId}
          note={dropNote}
          busy={busy === `drop-${dropFor.id}`}
          onReason={setDropReasonId}
          onNote={setDropNote}
          onCancel={() => setDropFor(null)}
          onConfirm={confirmDrop}
        />
      )}

      {removeFor && (
        <ConfirmDialog
          title={`Remove ${removeFor.product.name}?`}
          body="Removing takes it off this visit. Use Drop if the customer tried it and didn’t want it."
          confirmLabel="Remove"
          danger
          busy={busy === `remove-${removeFor.id}`}
          onCancel={() => setRemoveFor(null)}
          onConfirm={() => {
            const card = removeFor;
            void run(
              `remove-${card.id}`,
              async () => {
                await callApi(visitId, "remove", { visitProductId: card.id });
                setRemoveFor(null);
              },
              { title: "Removed", body: card.product.name },
            );
          }}
        />
      )}
    </div>
  );
}

/* ---------- Product row ---------- */

function ProductThumb({ name, imageUrl, tone }: { name: string; imageUrl?: string | null; tone?: string }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 40px thumb from dynamic Supabase storage URLs (per-project host, not whitelisted); lazy + async so scan stays fast.
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-10 shrink-0 rounded-xl border border-[#e8dfd6] bg-[#f3eeea] object-cover"
      />
    );
  }
  return (
    <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-xl text-[14px] font-bold ${tone ?? "bg-[#f3eeea] text-[#57534e]"}`}>
      {(name || "?").charAt(0)}
    </span>
  );
}

function ProductRow({ card, children, muted }: { card: ProductCardDTO; children?: ReactNode; muted?: boolean }) {
  const tone =
    card.status === "LIKED" ? "bg-[#e6f4ec] text-[#177245]"
    : card.status === "DROPPED" ? "bg-[#fdecec] text-[#7d1a1f]"
    : card.status === "TRIAL_IN_PROGRESS" ? "bg-[#fdf1d7] text-[#9a5b00]"
    : "bg-[#f3eeea] text-[#57534e]";
  return (
    <div className={`pressable flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${muted ? "border-[#e8dfd6] bg-[#faf8f6]" : "border-[#e8dfd6] bg-white"}`}>
      <div className="flex min-w-0 items-start gap-3">
        <ProductThumb name={card.product.name} imageUrl={card.product.imageUrl} tone={tone} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[15px] font-semibold tracking-tight text-[#1c1917]">{card.product.name}</p>
            <ProductStatusBadge status={card.status} />
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-[#78716c]">
            {card.product.colour} · {card.product.size} · <span className="tnum font-semibold text-[#1c1917]">{INR.format(card.product.price)}</span>
          </p>
          <p className="mt-0.5 font-mono text-[12px] text-[#76716b]">{card.product.sku}</p>
          {card.status === "DROPPED" && card.dropReason && (
            <p className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-[#fdecec] px-2 py-1 text-[13px] font-medium text-[#7d1a1f]">
              Reason: {card.dropReason.label}
              {card.note ? ` — ${card.note}` : ""}
            </p>
          )}
        </div>
      </div>
      {children && <div className="flex gap-2 sm:shrink-0">{children}</div>}
    </div>
  );
}

/* ---------- Drop reason dialog (reason is mandatory) ---------- */

function DropReasonDialog({
  card,
  reasons,
  reasonId,
  note,
  busy,
  onReason,
  onNote,
  onCancel,
  onConfirm,
}: {
  card: ProductCardDTO;
  reasons: DropReason[];
  reasonId: string;
  note: string;
  busy: boolean;
  onReason: (id: string) => void;
  onNote: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const selected = reasons.find((r) => r.id === reasonId);
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={`Why was ${card.product.name} dropped?`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:items-center"
    >
      <div className="ui-rise flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="border-b border-[#e8dfd6] p-5">
          <h3 className="text-[16px] font-semibold text-[#1c1917]">Why didn’t the customer take it?</h3>
          <p className="mt-0.5 truncate text-[13.5px] text-[#78716c]">{card.product.name} · {card.product.sku}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#78716c]">
            Required on anything liked or trialled but not billed: size, colour, price, design, material, other.
            Vendor reports are built on this field.
          </p>
        </div>

        <fieldset className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-4">
          <legend className="sr-only">Drop reason</legend>
          {reasons.map((r) => (
            <label
              key={r.id}
              className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg border px-3.5 text-[14.5px] font-medium transition-colors ${
                reasonId === r.id ? "border-[var(--staff-brand)] bg-[#fbe9ef] text-[#1c1917]" : "border-[#e8dfd6] bg-white text-[#57534e] hover:border-[#a8a29e]"
              }`}
            >
              <input type="radio" name="drop-reason" value={r.id} checked={reasonId === r.id} onChange={() => onReason(r.id)} className="sr-only" />
              <span aria-hidden className={`grid h-4 w-4 place-items-center rounded-full border ${reasonId === r.id ? "border-[var(--staff-brand)]" : "border-[#d6c9bb]"}`}>
                {reasonId === r.id && <span className="h-2 w-2 rounded-full bg-[var(--staff-brand)]" />}
              </span>
              {r.label}
            </label>
          ))}

          {selected?.code === "OTHER" && (
            <div className="mt-2">
              <label htmlFor="drop-note" className="text-[13px] font-semibold text-[#44403c]">Add a note</label>
              <textarea
                id="drop-note"
                value={note}
                onChange={(e) => onNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="What didn’t work?"
                className="mt-1 w-full rounded-lg border border-[#d6c9bb] bg-white px-3.5 py-2.5 text-[15px] text-[#1c1917] placeholder:text-[#76716b] focus:border-[var(--staff-brand)] focus:outline-none"
              />
            </div>
          )}
        </fieldset>

        <div className="flex gap-2 border-t border-[#e8dfd6] p-4">
          <SecondaryButton onClick={onCancel} className="min-h-[48px] flex-1">Cancel</SecondaryButton>
          <button
            onClick={onConfirm}
            disabled={!reasonId || busy}
            className="min-h-[48px] flex-1 rounded-lg bg-[#1c1917] px-4 text-[14.5px] font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving…" : "Confirm drop"}
          </button>
        </div>
      </div>
    </div>
  );
}
