"use client";

/* Stage 3, inside the visit workspace. Scan → trial → like / drop.
   Same visit, same API. No second application. */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Btn, Drawer, EmptyNote, ErrorNote, StatusMark } from "@/components/floor/ui";
import { DropReasonModal, type DropModalState } from "@/components/floor/drop-reason-modal";
import { useStore } from "@/lib/store";
import { searchTokens } from "@/lib/fuzzy";
import { requestRunner, setVisitSuite, lookupBarcode } from "@/lib/api";
import type { ProductCardDTO, VisitWithProductsDTO } from "@/features/visits/products/dto";
import { useVisitProductsRealtime } from "@/features/visits/products/use-visit-products-realtime";
import type { ProductVisitStatus } from "@/features/visits/products/types";
import { clockTime, formatINR } from "@/lib/utils";

type DropReason = VisitWithProductsDTO["dropReasons"][number];
type Filter = "ALL" | "SELECTED" | "TRIAL" | "LIKED" | "DROPPED" | "BILLED";
type SortKey = "priority" | "price-desc" | "price-asc" | "name";

/* Header buttons (workspace) drive the board without prop-drilling every
   drawer: each new seq triggers once. Suite changes report up so the
   workspace header chip stays in sync with the rail assignment. */
export interface BoardExternalAction {
  seq: number;
  kind: "scan" | "search" | "summary";
}

/* Fitting suites mirror the server allowlist (VISIT_SUITES) — client copy so
   the server module (Supabase admin reads) never ships to the browser. */
const SUITES = [
  { id: "SUITE_01", label: "Suite 01" },
  { id: "SUITE_02", label: "Suite 02" },
  { id: "SUITE_03", label: "Suite 03" },
  { id: "SALON_VIP", label: "Salon VIP" },
] as const;

export function suiteLabelLocal(suite: string | null | undefined): string | null {
  if (!suite) return null;
  return SUITES.find((s) => s.id === suite)?.label ?? suite;
}

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
};

type SearchCandidate = ScanResult["product"] & { alreadyAdded: boolean };

type LoadState =
  | { status: "loading" }
  | { status: "error"; code: string; message: string }
  | { status: "ready"; data: VisitWithProductsDTO };

class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function friendly(code: string, message: string): { title: string; body: string } {
  switch (code) {
    case "PRODUCT_NOT_FOUND":
      return { title: "Product not found.", body: "Check the barcode or SKU, or search by name." };
    case "PRODUCT_ALREADY_ADDED":
      return { title: "Already on this visit.", body: "That product is already with this customer." };
    case "DROP_REASON_REQUIRED":
      return { title: "Choose a reason.", body: "A dropped product always needs a reason — the vendor reports are built on it." };
    case "BILL_NUMBER_REQUIRED":
      return { title: "Bill number required.", body: "Enter the bill number to close the sale against this piece." };
    case "VISIT_HAS_UNBILLED_ITEMS":
      return { title: "Unbilled items remain.", body: message || "Mark each liked or in-trial piece billed — or drop it with a reason — before closing." };
    case "INVALID_PRODUCT_STATE":
      return { title: "That step isn't available.", body: message || "The product moved to a different state. The board just refreshed." };
    case "VISIT_NOT_ACTIVE":
      return { title: "This visit is not active.", body: "Start the visit before scanning products." };
    case "VISIT_ALREADY_COMPLETED":
      return { title: "This visit is closed.", body: "Closed visits cannot be changed." };
    case "UNAUTHORIZED":
      return { title: "Session expired.", body: "Sign in again to continue this visit." };
    case "FORBIDDEN":
      return { title: "You cannot change this visit.", body: "It belongs to another store." };
    case "OFFLINE":
      return { title: "Connection lost.", body: "We couldn't save this. Check your connection and try again." };
    default:
      return { title: "That didn't save.", body: message || "Try again. Your place in the visit is unchanged." };
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

async function fetchVisit(visitId: string): Promise<LoadState> {
  try {
    const res = await fetch(`/api/visits/${visitId}/products`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { status: "error", code: json.code ?? "INTERNAL", message: json.message ?? "Could not load visit" };
    return { status: "ready", data: json.data as VisitWithProductsDTO };
  } catch {
    return { status: "error", code: "OFFLINE", message: "Connection lost" };
  }
}

function statusKey(status: ProductVisitStatus): string {
  if (status === "LIKED" || status === "PURCHASED") return "liked";
  if (status === "DROPPED") return "dropped";
  if (status === "TRIAL_IN_PROGRESS") return "trial";
  if (status === "TRIAL_COMPLETED") return "ready";
  return "selected";
}

function statusLabel(status: ProductVisitStatus): string {
  /* UI shows one merged "Trial" label — TRIAL_IN_PROGRESS and TRIAL_COMPLETED
     both display as "Trial" (state machine keeps them distinct internally). */
  if (status === "TRIAL_IN_PROGRESS" || status === "TRIAL_COMPLETED") return "Trial";
  if (status === "LIKED") return "Liked";
  if (status === "DROPPED") return "Dropped";
  if (status === "PURCHASED") return "Purchased";
  return "Selected";
}

function ago(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  return clockTime(iso);
}

/* Amazon-style matched-text highlight: the typed letters go bold inside each
   suggestion so the eye lands on why it matched. */
function Hi({ text, query }: { text: string; query: string }) {
  // Tokens are normalized [a-z0-9] words, so they splice safely into a regex.
  const tokens = searchTokens(query).filter((t) => t.length >= 2);
  if (!tokens.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${tokens.join("|")})`, "gi"));
  if (parts.length <= 1) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-transparent font-bold text-[var(--fp-ink)]">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

export function FloorBoard({
  visitId,
  onHandoff,
  externalAction,
  onSuiteChange,
  readOnly,
}: {
  visitId: string;
  onHandoff?: () => void;
  externalAction?: BoardExternalAction | null;
  onSuiteChange?: (suite: string | null) => void;
  /** Closed visit: full record visible, every action hidden. */
  readOnly?: boolean;
}) {
  const { pushToast, abandonVisit } = useStore();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ title: string; body: string } | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<SortKey>("priority");
  const [torchOn, setTorchOn] = useState(false);
  const [runnerNote, setRunnerNote] = useState("");
  const [runnerBusy, setRunnerBusy] = useState(false);
  const [suiteBusy, setSuiteBusy] = useState(false);
  /* Camera lifecycle: permission is requested ONLY on an explicit "Start
     camera" tap — never as a side effect of opening the scanner panel.
     "denied" / "unsupported" render their own recovery UI instead of a
     dead video frame. */
  const [camState, setCamState] = useState<"off" | "starting" | "live" | "denied" | "unsupported">("off");
  const [searchOpen, setSearchOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [endingVisit, setEndingVisit] = useState(false);
  const [detail, setDetail] = useState<ProductCardDTO | null>(null);
  const [dropModal, setDropModal] = useState<DropModalState | null>(null);
  const [dropBusy, setDropBusy] = useState(false);
  /* Combined bill (Amazon-cart style): liked pieces ticked on the board share
     ONE bill drawer and ONE optional bill number. */
  const [billIds, setBillIds] = useState<string[]>([]);
  const [billOpen, setBillOpen] = useState(false);
  const [billNumber, setBillNumber] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchCandidate[] | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const searchReq = useRef(0);
  const scanRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const camStop = useRef<(() => void) | null>(null);

  const refresh = useCallback(async () => {
    const next = await fetchVisit(visitId);
    setState(next);
    if (next.status === "ready") {
      setDetail((cur) => (cur ? next.data.products.find((p) => p.id === cur.id) ?? cur : cur));
    }
  }, [visitId]);

  useVisitProductsRealtime(visitId, refresh);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchVisit(visitId);
      if (!cancelled) setState(next);
    })();
    return () => { cancelled = true; };
  }, [visitId]);

  const stopCamera = useCallback(() => {
    camStop.current?.();
    camStop.current = null;
    setCamState("off");
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // When "Add product" is clicked, the search field appears right beside it.
  // Focus it so typing starts immediately and never gets lost.
  useEffect(() => {
    if (searchOpen) {
      const t = window.setTimeout(() => searchInputRef.current?.focus(), 40);
      return () => window.clearTimeout(t);
    }
  }, [searchOpen]);

  const run = useCallback(async (key: string, fn: () => Promise<unknown>, success?: { title: string; body?: string }) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      await refresh();
      if (success) pushToast(success.title, success.body);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "INTERNAL";
      setErr(friendly(code, e instanceof Error ? e.message : ""));
    } finally {
      setBusy(null);
    }
  }, [refresh, pushToast]);

  const lookup = useCallback(async (value: string) => {
    const code = value.trim();
    if (!code) return;
    setScanning(true);
    setErr(null);
    setScanResult(null);
    try {
      const data = (await callApi(visitId, "scan", { identifier: code })) as ScanResult;
      setScanResult(data);
      if (data.alreadyAdded) pushToast("Already on this visit", data.product.product.name);
    } catch (e) {
      const apiCode = e instanceof ApiError ? e.code : "INTERNAL";
      if (apiCode === "PRODUCT_NOT_FOUND" && code.length >= 2) {
        // Product-level exact match first (GET /api/barcode): SJ exports carry
        // company_barcode / parent SKU on the product row, which the variant
        // resolver never sees — a hit re-runs the search by that product's
        // name so its variants surface instead of dead-ending on "not found".
        try {
          const exact = await lookupBarcode(code);
          if (exact.ok && exact.data.length > 0) {
            const hit = exact.data[0];
            const query = hit.name || hit.sku;
            const found = await callApi(visitId, "search", { query });
            if (found.results.length > 0) {
              setSearchResults(found.results);
              setSearchQuery(query);
              setActiveIdx(0);
              setSearchOpen(true);
              stopCamera();
              pushToast("Matched by barcode", hit.name);
              return;
            }
          }
        } catch { /* fall through to the typed search */ }
        try {
          const found = (await callApi(visitId, "search", { query: code })) as { results: SearchCandidate[] };
          if (found.results.length > 0) {
            setSearchResults(found.results);
            setSearchQuery(code);
            setSearchOpen(true);
            stopCamera();
            return;
          }
        } catch { /* fall through */ }
      }
      setErr(friendly(apiCode, e instanceof Error ? e.message : ""));
    } finally {
      setScanning(false);
    }
  }, [pushToast, stopCamera, visitId]);

  /* Opening the panel must NEVER trigger the permission prompt — it only
     reveals the viewport and focuses the manual field (handheld USB/Bluetooth
     scanners type straight into it, no camera needed). */
  const openScan = () => {
    setScanResult(null);
    setIdentifier("");
    setErr(null);
    window.setTimeout(() => scanRef.current?.focus(), 40);
  };

  /* Camera starts only from the explicit "Start camera" tap, so the browser
     prompt arrives with context. Every failure mode gets a human state:
     denied → how to re-enable; insecure context / no BarcodeDetector →
     manual entry is the fallback, never a silently dead frame. */
  const startCamera = async () => {
    const Detector = (window as unknown as { BarcodeDetector?: new (o?: { formats?: string[] }) => { detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setCamState("unsupported");
      return;
    }
    setCamState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = videoRef.current;
      if (!video) { stream.getTracks().forEach((t) => t.stop()); setCamState("off"); return; }
      video.srcObject = stream;
      await video.play();
      const detector = new Detector({ formats: ["ean_13", "ean_8", "code_128", "qr_code", "upc_a", "upc_e"] });
      let stopped = false;
      camStop.current = () => {
        stopped = true;
        stream.getTracks().forEach((t) => t.stop());
      };
      const tick = async () => {
        if (stopped) return;
        try {
          const codes = await detector.detect(video);
          const raw = codes[0]?.rawValue;
          if (raw) {
            stopped = true;
            stream.getTracks().forEach((t) => t.stop());
            camStop.current = null;
            setCamState("off"); // tracks are gone — don't claim "live"
            setIdentifier(raw);
            void lookup(raw);
            return;
          }
        } catch { /* keep listening */ }
        requestAnimationFrame(() => void tick());
      };
      void tick();
      setCamState("live");
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
        setCamState("denied");
      } else {
        /* NotReadableError (camera in use), NotFoundError (no camera) —
           manual entry / handheld scanner still works. */
        setCamState("unsupported");
      }
    }
  };

  const closeScan = () => {
    stopCamera();
    setTorchOn(false);
    setErr(null);
  };

  /* Workspace header buttons (Scan product / Add by SKU / Finish & bill)
     trigger the board's drawers and panels. They only render while the visit
     is ACTIVE, so every tap always has a mounted board to answer it. Deferred
     in a timer (the codebase pattern for external-state sync) so no setState
     runs in the effect body; the seq guard makes each header tap fire
     exactly once. */
  const consumedSeq = useRef(0);
  useEffect(() => {
    if (!externalAction || externalAction.seq === consumedSeq.current) return;
    consumedSeq.current = externalAction.seq;
    const kind = externalAction.kind;
    const t = window.setTimeout(() => {
      if (kind === "scan") openScan();
      else if (kind === "search") setSearchOpen(true);
      else setSummaryOpen(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [externalAction]);

  const toggleTorch = useCallback(async () => {
    const video = videoRef.current;
    const track = (video?.srcObject as MediaStream | null)?.getVideoTracks()?.[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] } as unknown as MediaTrackConstraints);
      setTorchOn((v) => !v);
    } catch {
      pushToast("Flash unavailable", "This camera does not expose a torch.");
    }
  }, [pushToast, torchOn]);

  const assignSuite = useCallback(async (suite: string) => {
    setSuiteBusy(true);
    const r = await setVisitSuite(visitId, suite);
    setSuiteBusy(false);
    if (!r.ok) {
      setErr({ title: "Suite not assigned.", body: r.message });
      return;
    }
    onSuiteChange?.(r.data.suite ?? suite);
    pushToast(`Moved to ${suiteLabelLocal(r.data.suite ?? suite) ?? suite}`, "Runner and billing see the same suite.");
    void refresh();
  }, [onSuiteChange, pushToast, refresh, visitId]);

  const callRunner = useCallback(async () => {
    setRunnerBusy(true);
    const r = await requestRunner(visitId, runnerNote.trim() || undefined);
    setRunnerBusy(false);
    if (!r.ok) {
      setErr({ title: "Runner not called.", body: r.message });
      return;
    }
    setRunnerNote("");
    pushToast("Runner called", r.data.note ? `${r.data.note} · ${suiteLabelLocal(r.data.suite) ?? "floor"}` : "They are on their way.");
  }, [pushToast, runnerNote, visitId]);

  const addVariant = (id: string, name: string) => {
    void run(`add-${id}`, async () => {
      await callApi(visitId, "add", { productVariantId: id });
      setScanResult(null);
      setIdentifier("");
      // Keep the inline search open so the FC can add multiple pieces.
      // Just mark the added row instead of wiping the typed query.
      setSearchResults((cur) => (cur ? cur.map((c) => (c.id === id ? { ...c, alreadyAdded: true } : c)) : cur));
      closeScan();
    }, { title: "Added to visit", body: name });
  };

  const doSearch = async (opts?: { quiet?: boolean }) => {
    const q = searchQuery.trim();
    if (q.length < 2) return null;
    const my = ++searchReq.current;
    setSearching(true);
    if (!opts?.quiet) setErr(null);
    try {
      const found = (await callApi(visitId, "search", { query: q })) as { results: SearchCandidate[] };
      if (my !== searchReq.current) return null; // a newer keystroke won
      setSearchResults(found.results);
      setActiveIdx(found.results.length ? 0 : -1);
      if (found.results.length === 0 && !opts?.quiet) setErr({ title: "No product matches that search.", body: "Try the product name, SKU, or barcode." });
      return found.results;
    } catch (e) {
      if (my !== searchReq.current) return null;
      setErr(friendly(e instanceof ApiError ? e.code : "INTERNAL", e instanceof Error ? e.message : ""));
      return null;
    } finally {
      if (my === searchReq.current) setSearching(false);
    }
  };

  /* Amazon-style live suggestions: search as they type (debounced), so the
     list narrows with every letter instead of waiting for Search. State only
     changes inside the timer callback, never the effect body. */
  useEffect(() => {
    if (!searchOpen) return;
    const t = window.setTimeout(() => {
      if (searchQuery.trim().length < 2) {
        setSearchResults(null);
        setSearching(false);
        return;
      }
      void doSearch({ quiet: true });
    }, 260);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchOpen]);

  const pickActive = () => {
    if (!searchResults?.length) return;
    const c = searchResults[Math.min(Math.max(activeIdx, 0), searchResults.length - 1)];
    if (c && !c.alreadyAdded) addVariant(c.id, c.product.name);
  };

  /* Opens the drop modal for `card`. Trialled/liked pieces get chained into a
     review queue (screenshot's "Item X of Y") so the FC can churn through a
     whole wardrobe in one pass; a quick drop straight from SELECTED (never
     tried on) stays a single-item flow. */
  const openDrop = useCallback((card: ProductCardDTO) => {
    const source = state.status === "ready" ? state.data.products : [];
    const pool = card.status === "SELECTED"
      ? [card]
      : source.filter((p) => p.status === "TRIAL_IN_PROGRESS" || p.status === "TRIAL_COMPLETED" || p.status === "LIKED");
    const queue = pool.some((p) => p.id === card.id) ? pool : [card];
    const index = Math.max(0, queue.findIndex((p) => p.id === card.id));
    setDropModal({ card, queue, index });
  }, [state]);

  const advanceOrClose = () => {
    setDropModal((cur) => {
      if (!cur) return null;
      const { queue, index } = cur;
      return index < queue.length - 1 ? { card: queue[index + 1], queue, index: index + 1 } : null;
    });
  };

  const saveDrop = ({ reasonId, subCategory, note }: { reasonId: string; subCategory: string | null; note: string }) => {
    if (!dropModal || state.status !== "ready" || dropBusy) return;
    const card = dropModal.card;
    const reasonLabel = state.data.dropReasons.find((r) => r.id === reasonId)?.label ?? "";
    setDropBusy(true);
    setErr(null);
    void (async () => {
      try {
        await callApi(visitId, "drop", {
          visitProductId: card.id,
          dropReasonId: reasonId,
          subCategory: subCategory || undefined,
          note: note || undefined,
        });
        await refresh();
        pushToast("Dropped", reasonLabel ? `${card.product.name} — ${reasonLabel}` : card.product.name);
        setDetail(null);
        advanceOrClose();
      } catch (e) {
        setErr(friendly(e instanceof ApiError ? e.code : "INTERNAL", e instanceof Error ? e.message : ""));
      } finally {
        setDropBusy(false);
      }
    })();
  };

  const openBill = (card: ProductCardDTO) => {
    setBillIds([card.id]);
    setBillNumber("");
    setBillOpen(true);
  };

  const toggleBillSelect = (id: string) => {
    setBillIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  type BulkBillData = {
    billed: Array<{ product: { name: string } }>;
    failed: Array<{ visitProductId: string; message: string }>;
    billNumber: string | null;
  };

  /** Bill one — or 2–3 — liked pieces on a single bill. Bill number optional. */
  const confirmBill = () => {
    const ids = billIds.filter((id) => products.some((p) => p.id === id && p.status === "LIKED"));
    const targets = ids.length > 0 ? ids : billIds;
    if (targets.length === 0 || busy) return;
    const bill = billNumber.trim();
    setBusy("bill-many");
    setErr(null);
    void (async () => {
      try {
        const data = (await callApi(visitId, "mark-purchased-many", {
          visitProductIds: targets,
          billNumber: bill,
        })) as BulkBillData;
        await refresh();
        setBillOpen(false);
        setBillIds([]);
        setDetail(null);
        if (data.billed.length > 0) {
          const names = data.billed.map((b) => b.product.name).slice(0, 3).join(", ");
          pushToast(
            data.billed.length > 1 ? `Billed ${data.billed.length} items together` : "Billed",
            `${names}${data.billNumber ? ` · Bill ${data.billNumber}` : ""}`,
          );
        }
        if (data.failed.length > 0) {
          setErr({
            title: `${data.failed.length} piece${data.failed.length > 1 ? "s" : ""} could not be billed.`,
            body: data.failed.map((f) => f.message).join(" "),
          });
        }
      } catch (e) {
        setErr(friendly(e instanceof ApiError ? e.code : "INTERNAL", e instanceof Error ? e.message : ""));
      } finally {
        setBusy(null);
      }
    })();
  };

  /** FC closes the customer without a purchase (nothing bought / walk-out). */
  const endVisit = () => {
    if (!confirmEnd) {
      setConfirmEnd(true);
      return;
    }
    if (endingVisit) return;
    setEndingVisit(true);
    void (async () => {
      await abandonVisit(visitId);
      setEndingVisit(false);
      setConfirmEnd(false);
      setSummaryOpen(false);
      pushToast("Visit ended", "The customer left without a purchase.");
    })();
  };

  const products = state.status === "ready" ? state.data.products : [];
  const summary = state.status === "ready" ? state.data.summary : null;
  const counts = useMemo(() => {
    const list = state.status === "ready" ? state.data.products : [];
    return {
      all: list.length,
      selected: list.filter((p) => p.status === "SELECTED").length,
      trial: list.filter((p) => p.status === "TRIAL_IN_PROGRESS" || p.status === "TRIAL_COMPLETED").length,
      liked: list.filter((p) => p.status === "LIKED").length,
      dropped: list.filter((p) => p.status === "DROPPED").length,
      billed: list.filter((p) => p.status === "PURCHASED").length,
    };
  }, [state]);

  const visible = products.filter((p) => {
    if (filter === "SELECTED") return p.status === "SELECTED";
    if (filter === "TRIAL") return p.status === "TRIAL_IN_PROGRESS" || p.status === "TRIAL_COMPLETED";
    if (filter === "LIKED") return p.status === "LIKED";
    if (filter === "DROPPED") return p.status === "DROPPED";
    if (filter === "BILLED") return p.status === "PURCHASED";
    return true;
  });

  /* Mockup "Sort: Trial Priority" — active trials surface first. */
  const SORT_RANK: Record<ProductVisitStatus, number> = {
    TRIAL_IN_PROGRESS: 0,
    TRIAL_COMPLETED: 1,
    LIKED: 2,
    SELECTED: 3,
    DROPPED: 4,
    PURCHASED: 5,
  };
  const sorted = [...visible].sort((a, b) => {
    if (sort === "price-desc") return b.product.price - a.product.price;
    if (sort === "price-asc") return a.product.price - b.product.price;
    if (sort === "name") return a.product.name.localeCompare(b.product.name);
    return SORT_RANK[a.status] - SORT_RANK[b.status] || b.product.price - a.product.price;
  });

  /* Mockup "BAG TOTAL": sum of everything the customer keeps. */
  const bagItems = products.filter((p) => p.status === "LIKED" || p.status === "PURCHASED");
  const bagTotal = bagItems.reduce((s, p) => s + p.product.price, 0);
  const bagAvg = bagItems.length > 0 ? Math.round(bagTotal / bagItems.length) : 0;

  /* Stat-bar inputs: decided = verdict reached; trialledTotal = ever tried on. */
  const decided = (summary?.liked ?? 0) + (summary?.dropped ?? 0) + (summary?.purchased ?? 0);
  const trialledTotal = (summary?.trialInProgress ?? 0) + (summary?.trialCompleted ?? 0) + decided;
  const decidedPct = trialledTotal ? Math.round((decided / trialledTotal) * 100) : 0;
  const likedTotal = (summary?.liked ?? 0) + (summary?.purchased ?? 0);

  const suite = state.status === "ready" ? state.data.visit.suite : null;

  /* Combined-bill selection: only LIKED pieces can share one bill. */
  const billItems = products.filter((p) => billIds.includes(p.id) && p.status === "LIKED");
  const billTotal = billItems.reduce((s, p) => s + p.product.price, 0);

  const dropReasons = (() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (p.status === "DROPPED" && p.dropReason) map.set(p.dropReason.label, (map.get(p.dropReason.label) ?? 0) + 1);
    }
    return [...map.entries()];
  })();

  /* Roadmap close-out: anything liked or trialled but not billed still needs
     a verdict (billed with a bill number, or dropped with a reason) before
     the visit can close. SELECTED-only rows never started a trial. Plain
     filter (no memo): visit lists are small and this must track products. */
  const outstanding = products.filter(
    (p) => p.status === "LIKED" || p.status === "TRIAL_IN_PROGRESS" || p.status === "TRIAL_COMPLETED",
  );

  if (state.status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading products" className="mt-6">
        <div className="fp-skel h-10 w-full" />
        <div className="mt-4 flex flex-col gap-2">
          <div className="fp-skel h-16" />
          <div className="fp-skel h-16" />
          <div className="fp-skel h-16" />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    const f = friendly(state.code, state.message);
    return (
      <div className="mt-6">
        <ErrorNote
          title={state.code === "VISIT_NOT_FOUND" ? "This visit is not on the floor yet." : f.title}
          body={state.code === "VISIT_NOT_FOUND" ? "Start the visit, then scan the first product." : f.body}
          action={<Btn tone="line" onClick={() => { setState({ status: "loading" }); void refresh(); }}>Retry</Btn>}
        />
      </div>
    );
  }

  return (
    <div className="mt-6">
      {/* Ops-console stat cards: derived counts, never stored. Bars show
          share-of-visit so the FC reads the funnel at a glance. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Selected items"
          value={summary?.selected ?? 0}
          sub="in wardrobe"
          pct={products.length ? Math.round(((summary?.selected ?? 0) / products.length) * 100) : 0}
        />
        <StatCard
          label="Trials"
          value={(summary?.trialInProgress ?? 0) + (summary?.trialCompleted ?? 0)}
          sub={`${decidedPct}% evaluated`}
          pct={trialledTotal ? Math.round((decided / trialledTotal) * 100) : 0}
        />
        <StatCard
          label="Liked"
          value={(summary?.liked ?? 0) + (summary?.purchased ?? 0)}
          sub="Ready to pack"
          tone="green"
          pct={likedTotal ? Math.round(((summary?.purchased ?? 0) / likedTotal) * 100) : 0}
        />
        <StatCard
          label="Dropped"
          value={summary?.dropped ?? 0}
          sub="Back on the rail"
          tone="red"
          pct={products.length ? Math.round(((summary?.dropped ?? 0) / products.length) * 100) : 0}
        />
        <div className="rounded-xl border border-[#e9e2d8] bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b645c]">Bag total</p>
          <p className="fp-num mt-1.5 text-[26px] font-bold leading-none tracking-tight text-[#211d18]">{formatINR(bagTotal)}</p>
          <p className="fp-num mt-1.5 text-[12px] text-[#6b645c]">Avg per piece: {formatINR(bagAvg)}</p>
        </div>
      </div>

      {err && <div className="mt-4"><ErrorNote title={err.title} body={err.body} action={<Btn tone="quiet" onClick={() => setErr(null)}>Dismiss</Btn>} /></div>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter products" className="flex flex-wrap items-center gap-1.5">
          {([
            ["ALL", "All", counts.all, false],
            ["SELECTED", "Selected", counts.selected, false],
            ["TRIAL", "Trials", counts.trial, true],
            ["LIKED", "Liked", counts.liked, false],
            ["DROPPED", "Dropped", counts.dropped, false],
            ["BILLED", "Billed", counts.billed, false],
          ] as const).map(([key, label, n, hot]) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(key)}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold uppercase tracking-wide transition-colors ${
                  active
                    ? "bg-[#23403a] text-white"
                    : hot
                      ? "bg-[var(--fp-brand-soft)] text-[var(--fp-brand)] hover:bg-[#f3ddd7]"
                      : "bg-[#f1ece4] text-[#57534e] hover:bg-[#e7dfd3]"
                }`}
              >
                {hot && !active && <span aria-hidden className="size-1.5 rounded-full bg-[var(--fp-brand)]" />}
                {label} <span className="fp-num font-bold">{n}</span>
              </button>
            );
          })}
        </div>
        <label className="inline-flex min-h-[44px] w-full items-center gap-2 text-[13px] font-medium text-[#6b645c] sm:ml-auto sm:w-auto">
          Sort:
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="min-h-[44px] flex-1 rounded-lg border border-[#e0d7c9] bg-white px-2.5 text-[16px] font-semibold text-[#211d18] sm:flex-none sm:text-[13.5px]"
          >
            <option value="priority">Try first</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
      </div>

      {!readOnly && searchOpen && (
        <div className="mt-3">
          <form
            id="add-product-search"
            className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (searchResults?.length) pickActive();
              else void doSearch();
            }}
          >
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setActiveIdx(-1); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && searchResults?.length) {
                  e.preventDefault();
                  setActiveIdx((i) => (i + 1) % searchResults.length);
                } else if (e.key === "ArrowUp" && searchResults?.length) {
                  e.preventDefault();
                  setActiveIdx((i) => (i - 1 + searchResults.length) % searchResults.length);
                } else if (e.key === "Escape") {
                  setSearchResults(null);
                  setActiveIdx(-1);
                }
              }}
              placeholder="Search name, SKU, or barcode…"
              aria-label="Search products"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={!!searchResults?.length}
              aria-controls="product-suggestions"
              aria-activedescendant={activeIdx >= 0 && searchResults?.[activeIdx] ? `suggest-${searchResults[activeIdx].id}` : undefined}
              className="min-h-11 min-w-0 flex-1 basis-40 rounded-lg border border-[var(--fp-line-strong)] bg-white px-3 text-[16px] sm:text-[15px]"
            />
            <Btn type="submit" tone="ink" disabled={searching || searchQuery.trim().length < 2}>{searching ? "Searching…" : "Search"}</Btn>
          </form>
        </div>
      )}

      {!readOnly && searchOpen && (searching || searchResults) && (
        <div className="mt-3 border border-[var(--fp-line)] bg-[var(--fp-surface)] px-4 py-3">
          {searching && !searchResults && <p role="status" className="text-[13.5px] font-semibold text-[var(--fp-muted)]">Searching…</p>}
          {searchResults && searchResults.length === 0 && !searching && <EmptyNote title="No matches." body="Check the spelling, try fewer words, or scan the barcode." />}
          {searchResults && searchResults.length > 0 && (
            <p role="status" className="text-[13px] font-medium text-[var(--fp-muted)]">
              {searchResults.length} match{searchResults.length > 1 ? "es" : ""} for <strong className="font-semibold text-[var(--fp-ink)]">“{searchQuery.trim()}”</strong>
              <span className="hidden sm:inline"> · ↑↓ to move · Enter adds · typos forgiven</span>
            </p>
          )}
          <ul role="listbox" id="product-suggestions" aria-label="Product suggestions">
            {searchResults?.map((c, i) => (
              <li
                key={c.id}
                id={`suggest-${c.id}`}
                role="option"
                aria-selected={i === activeIdx}
                aria-disabled={c.alreadyAdded || undefined}
                tabIndex={c.alreadyAdded ? -1 : 0}
                onMouseEnter={() => setActiveIdx(i)}
                onFocus={() => setActiveIdx(i)}
                onClick={() => { if (!c.alreadyAdded) addVariant(c.id, c.product.name); }}
                onKeyDown={(e) => {
                  if (c.alreadyAdded) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    addVariant(c.id, c.product.name);
                  }
                }}
                className={`flex cursor-pointer items-center justify-between gap-3 border-b border-[var(--fp-line)] py-3 last:border-b-0 ${i === activeIdx ? "bg-[var(--fp-ink-soft)]" : ""}`}
              >
                <ProductIdentity name={c.product.name} nameHi={<Hi text={c.product.name} query={searchQuery} />} sku={c.sku} size={c.size} colour={c.colour} price={c.price} imageUrl={c.imageUrl} compact href={`/products/${c.product.id}`} />
                {c.alreadyAdded ? (
                  <span className="shrink-0 text-[13px] font-semibold text-[var(--fp-wait)]">Added</span>
                ) : (
                  <Btn tone="ink" className="shrink-0" disabled={busy === `add-${c.id}`} onClick={(e) => { e.stopPropagation(); addVariant(c.id, c.product.name); }}>
                    {busy === `add-${c.id}` ? "Adding…" : "Add"}
                  </Btn>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <ul className="flex flex-col gap-3">
            {sorted.map((card) => (
              <li key={card.id}>
                <ProductRow
                  card={card}
                  busy={busy}
                  onOpen={() => setDetail(card)}
                  onTrial={() => {
                    // One Trial button: tap to start, tap again to complete,
                    // tap on a completed trial reopens it (customer tries again).
                    if (card.status === "SELECTED") {
                      void run(`start-${card.id}`, () => callApi(visitId, "start-trial", { visitProductId: card.id }), { title: "Trial started", body: card.product.name });
                    } else if (card.status === "TRIAL_IN_PROGRESS") {
                      void run(`complete-${card.id}`, () => callApi(visitId, "complete-trial", { visitProductId: card.id }), { title: "Trial completed", body: "Like it, or record why it was dropped." });
                    } else if (card.status === "TRIAL_COMPLETED") {
                      void run(`reopen-${card.id}`, () => callApi(visitId, "reopen-trial", { visitProductId: card.id }), { title: "Trial reopened", body: card.product.name });
                    }
                  }}
                  onLike={() => void run(`like-${card.id}`, () => callApi(visitId, "like", { visitProductId: card.id }), { title: "Liked", body: card.product.name })}
                  onUnlike={() => void run(`unlike-${card.id}`, () => callApi(visitId, "unlike", { visitProductId: card.id }), { title: "Like removed", body: `${card.product.name} is back where it was.` })}
                  onDrop={() => { openDrop(card); }}
                  onUndrop={() => void run(`undrop-${card.id}`, () => callApi(visitId, "undrop", { visitProductId: card.id }), { title: "Drop undone", body: `${card.product.name} is live again.` })}
                  onBill={() => openBill(card)}
                  selectable={!readOnly && card.status === "LIKED"}
                  checked={billIds.includes(card.id)}
                  onToggle={() => toggleBillSelect(card.id)}
                  readOnly={readOnly}
                />
              </li>
            ))}
          </ul>

      {/* Amazon-cart style: tick 2–3 liked pieces, bill them on one bill. */}
      {!readOnly && billIds.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border border-[var(--fp-line)] bg-[var(--fp-surface)] px-4 py-3">
          <p className="text-[14px] font-semibold">
            {billIds.length} selected
            {billTotal > 0 && <span className="fp-num font-semibold"> · {formatINR(billTotal)}</span>}
          </p>
          <span className="flex gap-2 sm:ml-auto">
            <ConsoleBtn disabled={busy === "bill-many"} onClick={() => { setBillNumber(""); setBillOpen(true); }}>
              Bill together
            </ConsoleBtn>
            <Btn tone="quiet" onClick={() => setBillIds([])}>Clear</Btn>
          </span>
        </div>
      )}

      {products.length === 0 && (
        <EmptyNote title="No products on this visit yet." body="Scan the barcode, or add a product by name. The customer stays on this visit." />
      )}
      {products.length > 0 && visible.length === 0 && (
        <EmptyNote
          title={filter === "DROPPED" ? "No products have been dropped during this visit." : "Nothing in this filter."}
          body="Switch back to All to see the full visit."
        />
      )}

        </div>

        {!readOnly && (
        <aside className="flex min-w-0 flex-col gap-4" aria-label="Scanner and floor tools">
          <SideSection
            label="Live tag scanner"
            onCollapse={closeScan}
            title={
              <p className="inline-flex items-center gap-2 text-[14px] font-bold text-[#211d18]">
                <span aria-hidden className="size-2 rounded-full bg-[var(--fp-brand)]" /> Live Tag Scanner
              </p>
            }
            meta={<span className="text-[11px] font-semibold text-[#7a736a]">{camState === "live" ? "Camera live" : camState === "denied" ? "Camera blocked" : "Manual entry"}</span>}
          >
            <div className="relative overflow-hidden rounded-lg bg-[#23403a]">
              <video ref={videoRef} muted playsInline aria-label="Live camera view for scanning product barcodes. Use manual entry below if the camera is unavailable." className="aspect-[16/10] max-h-[260px] w-full object-cover opacity-90 sm:aspect-[4/3] sm:max-h-none" />
              <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="h-[55%] w-[72%] rounded border-2 border-dashed border-white/60" />
              </div>
              <div aria-hidden className="pointer-events-none absolute left-[14%] right-[14%] top-1/2 h-[2px] -translate-y-1/2 bg-[#e5485a]/90" />
              {camState === "off" && (
                <button
                  type="button"
                  onClick={() => { openScan(); void startCamera(); }}
                  className="absolute inset-0 grid place-items-center bg-[#23403a]/55 text-[13.5px] font-bold text-white transition-colors hover:bg-[#23403a]/40"
                >
                  Start camera
                </button>
              )}
              {camState === "starting" && (
                <p role="status" className="absolute inset-0 grid place-items-center bg-[#23403a]/70 text-[13.5px] font-bold text-white">
                  Starting camera…
                </p>
              )}
              {camState === "denied" && (
                <div className="absolute inset-0 grid place-items-center bg-[#23403a]/85 p-4 text-center">
                  <div className="text-white">
                    <p className="text-[13.5px] font-bold">Camera access blocked</p>
                    <p className="mt-1 text-[12.5px] text-white/80">
                      Allow the camera for this site in your browser&apos;s address-bar settings, then tap Retry.
                      Manual entry and a handheld scanner work without it.
                    </p>
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="mt-3 inline-flex min-h-[36px] items-center rounded-full bg-white px-4 text-[12.5px] font-bold text-[#23403a]"
                    >
                      Retry camera
                    </button>
                  </div>
                </div>
              )}
              {camState === "unsupported" && (
                <div className="absolute inset-0 grid place-items-center bg-[#23403a]/85 p-4 text-center">
                  <div className="text-white">
                    <p className="text-[13.5px] font-bold">Camera unavailable</p>
                    <p className="mt-1 text-[12.5px] text-white/80">
                      No camera on this device, or the site is not on HTTPS. Type the barcode below, or use a
                      handheld scanner — it types into the field like a keyboard.
                    </p>
                  </div>
                </div>
              )}
              {camState === "live" && (
                <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => void toggleTorch()}
                    aria-pressed={torchOn}
                    aria-label="Toggle flash"
                    className={`inline-flex min-h-[44px] items-center rounded-full px-3.5 text-[12.5px] font-bold ${torchOn ? "bg-white text-[#23403a]" : "bg-white/20 text-white"}`}
                  >
                    Flash
                  </button>
                  <button
                    type="button"
                    onClick={closeScan}
                    aria-label="Stop camera"
                    className="inline-flex min-h-[44px] items-center rounded-full bg-white/20 px-3.5 text-[12.5px] font-bold text-white"
                  >
                    Stop
                  </button>
                </div>
              )}
            </div>
            <p className="mt-2.5 text-center text-[12.5px] text-[#7a736a]">
              {camState === "live"
                ? "Align tag barcode within reticle"
                : "Type the barcode, or tap Start camera — a handheld scanner types here too."}
            </p>
            {scanning && <p role="status" className="mt-2 text-center text-[13px] font-semibold text-[#57534e]">Looking up…</p>}
          </SideSection>

          <SideSection
            label="Last tag read"
            title={<p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#7a736a]">Last tag read</p>}
          >
            {scanResult ? (
              <div>
                <p className="truncate font-mono text-[13px] font-semibold text-[#211d18]">{scanResult.product.sku}</p>
                <p className="mt-0.5 truncate text-[13px] text-[#7a736a]">{scanResult.product.product.name}</p>
                <div className="mt-2.5">
                  {scanResult.alreadyAdded ? (
                    <p className="text-[13.5px] font-semibold text-[#9a5b00]">Already on this visit.</p>
                  ) : (
                    <button
                      type="button"
                      disabled={busy === `add-${scanResult.product.id}`}
                      onClick={() => addVariant(scanResult.product.id, scanResult.product.product.name)}
                      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#23403a] px-4 text-[14px] font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
                    >
                      {busy === `add-${scanResult.product.id}` ? "Adding…" : "Instant Add"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[13.5px] text-[#7a736a]">No tag read yet — scan or enter a code below.</p>
            )}
          </SideSection>

          <SideSection
            label="Manual SKU entry"
            title={<p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#7a736a]">Manual SKU entry</p>}
          >
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void lookup(identifier); }}>
              <div className="flex min-h-[44px] flex-1 items-center gap-1.5 rounded-lg border border-[#e0d7c9] bg-white px-3">
                <span aria-hidden className="font-mono text-[15px] text-[#a8a29e]">#</span>
                <input
                  ref={scanRef}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="JP-KUR-4091-M"
                  aria-label="Enter SKU manually"
                  autoComplete="off"
                  className="w-full bg-transparent font-mono text-[16px] outline-none placeholder:text-[#736c64] sm:text-[14px]"
                />
              </div>
              <button
                type="submit"
                disabled={scanning || !identifier.trim()}
                className="inline-flex min-h-[44px] items-center rounded-lg bg-[#23403a] px-5 text-[14px] font-bold text-white disabled:opacity-60"
              >
                {scanning ? "…" : "Enter"}
              </button>
            </form>
          </SideSection>

          <SideSection
            label="Fitting room"
            title={<p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#7a736a]">Fitting Room</p>}
            meta={<p className="text-[11.5px] font-semibold text-[#57534e]">Active: {suiteLabelLocal(suite) ?? "—"}</p>}
          >
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="group" aria-label="Assign fitting suite">
              {SUITES.map((s) => {
                const active = suite === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={suiteBusy}
                    onClick={() => void assignSuite(s.id)}
                    aria-pressed={active}
                    className={`min-h-[44px] rounded-lg px-1 text-[12px] font-bold transition-colors disabled:opacity-60 ${
                      active ? "bg-[#23403a] text-white" : "bg-[#f1ece4] text-[#57534e] hover:bg-[#e7dfd3]"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </SideSection>

          <SideSection
            label="Runner request"
            title={<p className="text-[14px] font-bold text-[#211d18]">Runner request</p>}
          >
            <p className="text-[13px] text-[#7a736a]">Size swap or steamer{suiteLabelLocal(suite) ? ` to ${suiteLabelLocal(suite)}` : ""}</p>
            <form
              className="mt-2.5 flex gap-2"
              onSubmit={(e) => { e.preventDefault(); void callRunner(); }}
            >
              <input
                value={runnerNote}
                onChange={(e) => setRunnerNote(e.target.value)}
                placeholder="What do you need?"
                aria-label="Runner request note"
                autoComplete="off"
                maxLength={200}
                className="min-h-[44px] flex-1 rounded-lg border border-[#e0d7c9] bg-white px-3 text-[16px] outline-none placeholder:text-[#736c64] sm:text-[14px]"
              />
              <button
                type="submit"
                disabled={runnerBusy}
                className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg bg-[#f1ece4] px-4 text-[13.5px] font-bold text-[#211d18] hover:bg-[#e7dfd3] disabled:opacity-60"
              >
                {runnerBusy ? "…" : "Call Runner"}
              </button>
            </form>
          </SideSection>
        </aside>)}
      </div>

      {detail && (
        <Drawer kicker="Product" title={detail.product.name} onClose={() => setDetail(null)}>
          <ProductIdentity name={detail.product.name} sku={detail.product.sku} size={detail.product.size} colour={detail.product.colour} price={detail.product.price} imageUrl={detail.product.imageUrl} href={`/products/${detail.product.id}`} />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusMark value={statusKey(detail.status)} label={statusLabel(detail.status)} />
            {detail.status === "PURCHASED" && (
              <span className="fp-num text-[13px] font-semibold text-[var(--fp-ok)]">
                {detail.billNumber ? `Bill ${detail.billNumber}` : "Billed"}
              </span>
            )}
          </div>
          {detail.status === "DROPPED" && detail.dropReason && (
            <p className="mt-3 text-[14px]">
              Reason: <span className="font-semibold">{detail.dropReason.label}</span>
              {detail.dropSubcategory ? <span className="font-semibold"> — {detail.dropSubcategory}</span> : null}
              {detail.note ? ` · ${detail.note}` : ""}
            </p>
          )}
          {!readOnly && (
          <NoteEditor
            key={detail.id}
            initial={detail.staffNote ?? ""}
            saving={busy === `note-${detail.id}`}
            onSave={(note) => {
              void run(`note-${detail.id}`, () => callApi(visitId, "note", { visitProductId: detail.id, note }), {
                title: note ? "Note saved" : "Note cleared",
                body: detail.product.name,
              });
            }}
          />)}
          <ol className="mt-5 border-t border-[var(--fp-line)] pt-4">
            <TimeRow at={detail.timeline.addedAt} label="Added" />
            <TimeRow at={detail.timeline.trialStartedAt} label="Trial started" />
            <TimeRow at={detail.timeline.trialCompletedAt} label="Trial completed" />
            <TimeRow at={detail.timeline.likedAt} label="Liked" />
            <TimeRow at={detail.timeline.droppedAt} label="Dropped" />
            <TimeRow at={detail.timeline.purchasedAt} label="Billed" />
          </ol>
          {!readOnly && (
          <div className="mt-5 flex flex-wrap gap-2">
            {detail.status === "SELECTED" && (
              <>
                <ConsoleBtn disabled={!!busy} onClick={() => void run(`start-${detail.id}`, () => callApi(visitId, "start-trial", { visitProductId: detail.id }), { title: "Trial started", body: detail.product.name })}>Trial</ConsoleBtn>
                <ConsoleBtn disabled={!!busy} onClick={() => void run(`like-${detail.id}`, () => callApi(visitId, "like", { visitProductId: detail.id }), { title: "Liked", body: detail.product.name })}>Like</ConsoleBtn>
                <ConsoleBtn disabled={!!busy} onClick={() => openBill(detail)}>Mark billed</ConsoleBtn>
                <ConsoleBtn onClick={() => { openDrop(detail); }}>Drop</ConsoleBtn>
              </>
            )}
            {detail.status === "TRIAL_IN_PROGRESS" && (
              <>
                <ConsoleBtn disabled={!!busy} onClick={() => void run(`complete-${detail.id}`, () => callApi(visitId, "complete-trial", { visitProductId: detail.id }), { title: "Trial completed", body: detail.product.name })}>Trial</ConsoleBtn>
                <ConsoleBtn disabled={!!busy} onClick={() => openBill(detail)}>Mark billed</ConsoleBtn>
                <ConsoleBtn onClick={() => { openDrop(detail); }}>Drop</ConsoleBtn>
              </>
            )}
            {detail.status === "TRIAL_COMPLETED" && (
              <>
                <ConsoleBtn disabled={!!busy} onClick={() => void run(`like-${detail.id}`, () => callApi(visitId, "like", { visitProductId: detail.id }), { title: "Liked", body: detail.product.name })}>Like</ConsoleBtn>
                <ConsoleBtn disabled={!!busy} onClick={() => openBill(detail)}>Mark billed</ConsoleBtn>
                <ConsoleBtn onClick={() => { openDrop(detail); }}>Drop</ConsoleBtn>
                <ConsoleBtn disabled={!!busy} onClick={() => void run(`reopen-${detail.id}`, () => callApi(visitId, "reopen-trial", { visitProductId: detail.id }), { title: "Trial reopened", body: detail.product.name })}>Trial</ConsoleBtn>
              </>
            )}
            {detail.status === "LIKED" && (
              <>
                <ConsoleBtn disabled={!!busy} onClick={() => openBill(detail)}>Mark billed</ConsoleBtn>
                <ConsoleBtn onClick={() => { openDrop(detail); }}>Drop</ConsoleBtn>
                <ConsoleBtn disabled={!!busy} onClick={() => void run(`unlike-${detail.id}`, () => callApi(visitId, "unlike", { visitProductId: detail.id }), { title: "Like removed", body: `${detail.product.name} is back where it was.` })}>Unlike</ConsoleBtn>
              </>
            )}
            {detail.status === "DROPPED" && (
              <ConsoleBtn disabled={!!busy} onClick={() => void run(`undrop-${detail.id}`, () => callApi(visitId, "undrop", { visitProductId: detail.id }), { title: "Drop undone", body: `${detail.product.name} is live again.` })}>Undo drop</ConsoleBtn>
            )}
          </div>)}
        </Drawer>
      )}

      {dropModal && state.status === "ready" && (
        <DropReasonModal
          state={dropModal}
          reasons={state.data.dropReasons}
          saving={dropBusy}
          onClose={() => setDropModal(null)}
          onSkip={advanceOrClose}
          onSave={saveDrop}
        />
      )}

      {summaryOpen && summary && (
        <Drawer kicker="Handoff" title="Visit summary" onClose={() => { setSummaryOpen(false); setConfirmEnd(false); }} footer={!readOnly && (
          <div className="flex flex-col gap-2">
            <Btn tone="brand" className="w-full" onClick={() => { setSummaryOpen(false); setConfirmEnd(false); onHandoff?.(); }}>
              {outstanding.length > 0 ? "Continue to billing" : "Close visit"}
            </Btn>
            {!confirmEnd ? (
              <Btn tone="quiet" className="w-full" onClick={() => setConfirmEnd(true)}>End visit (no purchase)</Btn>
            ) : (
              <div className="flex gap-2">
                <Btn tone="drop" className="flex-1" disabled={endingVisit} onClick={endVisit}>
                  {endingVisit ? "Ending…" : "Confirm — end visit"}
                </Btn>
                <Btn tone="line" disabled={endingVisit} onClick={() => setConfirmEnd(false)}>Keep</Btn>
              </div>
            )}
          </div>)}>
          <dl className="grid grid-cols-2 gap-y-4">
            <Sum k="Selected" v={summary.selected} />
            <Sum k="Trials" v={summary.trialInProgress + summary.trialCompleted} />
            <Sum k="Liked" v={summary.liked + summary.purchased} />
            <Sum k="Dropped" v={summary.dropped} />
            <Sum k="Billed" v={summary.purchased} />
          </dl>
          {outstanding.length > 0 ? (
            <div className="mt-5 border-t border-[var(--fp-line)] pt-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">
                Still to close · {outstanding.length}
              </p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--fp-muted)]">
                Billing needs every liked or in-trial piece resolved — mark it billed, or drop it with a reason.
              </p>
              <ul className="mt-2">
                {outstanding.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 border-b border-[var(--fp-line)] py-2 text-[14px]">
                    <span className="min-w-0 truncate font-medium">{p.product.name}</span>
                    <span className="shrink-0 text-[12.5px] text-[var(--fp-muted)]">{statusLabel(p.status)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            products.length > 0 && (
              <p className="mt-5 border-t border-[var(--fp-line)] pt-4 text-[14px] font-semibold text-[var(--fp-ok)]">
                Everything is resolved — safe to continue to billing.
              </p>
            )
          )}
          <div className="mt-5 border-t border-[var(--fp-line)] pt-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">Drop reasons</p>
            {dropReasons.length === 0 ? (
              <p className="mt-2 text-[14px] text-[var(--fp-muted)]">No products have been dropped during this visit.</p>
            ) : (
              <ul className="mt-2">
                {dropReasons.map(([label, n]) => (
                  <li key={label} className="flex justify-between border-b border-[var(--fp-line)] py-2 text-[14.5px]">
                    <span>{label}</span><span className="fp-num font-semibold">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Drawer>
      )}

      {billOpen && (
        <Drawer
          kicker={billItems.length > 1 ? `${billItems.length} items · one bill` : billItems[0]?.product.name ?? "Billing"}
          title={billItems.length > 1 ? "Bill together — one bill number" : "Billed — close the sale"}
          onClose={() => setBillOpen(false)}
          footer={
            <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); confirmBill(); }}>
              <div className="flex gap-2">
                <input
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  placeholder="Bill number — attached to each piece"
                  aria-label="Bill number — attached to each piece"
                  autoComplete="off"
                  autoFocus
                  maxLength={50}
                  className="min-h-11 flex-1 rounded-lg border border-[var(--fp-line-strong)] bg-white px-3 text-[15px]"
                />
                <ConsoleBtn type="submit" disabled={billItems.length === 0 || busy === "bill-many"}>
                  {busy === "bill-many" ? "Saving…" : billItems.length > 1 ? `Bill ${billItems.length} items` : "Mark billed"}
                </ConsoleBtn>
              </div>
              <p className="text-[12.5px] text-[var(--fp-muted)]">Bill number is attached and the sale is closed against the piece. Leave blank only for a cash sale with no bill yet.</p>
            </form>
          }
        >
          {billItems.length === 0 ? (
            <EmptyNote title="Nothing left to bill." body="The selected pieces were already billed or moved. Pick liked pieces from the board." />
          ) : (
            <>
              <ul>
                {billItems.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 border-b border-[var(--fp-line)] py-2.5 text-[14px]">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{p.product.name}</span>
                      <span className="font-mono text-[12px] text-[var(--fp-faint)]">{p.product.sku} · {p.product.size} · {p.product.colour}</span>
                    </span>
                    <span className="fp-num shrink-0 font-semibold">{formatINR(p.product.price)}</span>
                  </li>
                ))}
              </ul>
              {billItems.length > 1 && (
                <p className="mt-3 flex items-center justify-between text-[14px] font-semibold">
                  <span>Total</span>
                  <span className="fp-num">{formatINR(billTotal)}</span>
                </p>
              )}
              <p className="mt-2 text-[13.5px] text-[var(--fp-muted)]">
                One bill covers all {billItems.length > 1 ? `${billItems.length} items` : "this piece"}, like an Amazon order.
              </p>
            </>
          )}
        </Drawer>
      )}
    </div>
  );
}

function SideSection({
  label,
  title,
  meta,
  children,
  defaultOpen = true,
  onCollapse,
}: {
  label: string;
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  onCollapse?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => {
    if (open) onCollapse?.();
    setOpen((v) => !v);
  };
  return (
    <section className="rounded-xl border border-[#e9e2d8] bg-white p-4" aria-label={label}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">{title}</div>
        <div className="flex shrink-0 items-center gap-2">
          {meta}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
            className="inline-flex min-h-[44px] items-center rounded-lg bg-[#f1ece4] px-3 text-[12px] font-bold text-[#57534e] transition-colors hover:bg-[#e7dfd3]"
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      {open && <div className="mt-2.5">{children}</div>}
    </section>
  );
}

function StatCard({ label, value, sub, pct, tone }: { label: string; value: number; sub: string; pct: number; tone?: "green" | "red" }) {
  const bar = tone === "green" ? "bg-[#2e6b4f]" : tone === "red" ? "bg-[var(--fp-drop)]" : "bg-[#23403a]";
  const card = tone === "green" ? "bg-[#eef6f1]" : tone === "red" ? "bg-[var(--fp-drop-bg)]" : "bg-white";
  /* Tinted cards need a darker muted: #7a736a only reaches ~4.0–4.2:1 on the
     green/red washes. #5c564d clears 4.5:1 on every card variant. */
  const muted = tone ? "text-[#5c564d]" : "text-[#6b645c]";
  return (
    <div className={`rounded-xl border border-[#e9e2d8] ${card} p-4`}>
      <p className={`text-[11px] font-bold uppercase tracking-[0.1em] ${muted}`}>{label}</p>
      <p className="mt-1.5 flex items-baseline gap-2">
        <span className="fp-num text-[26px] font-bold leading-none tracking-tight text-[#211d18]">{value}</span>
        <span className={`text-[12px] font-medium ${muted}`}>{sub}</span>
      </p>
      <div aria-hidden className="mt-3 h-1 overflow-hidden rounded-full bg-[#e7dfd3]">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  );
}

function Sum({ k, v }: { k: string; v: number }) {
  return (
    <div>
      <dt className="text-[12.5px] text-[var(--fp-muted)]">{k}</dt>
      <dd className="fp-num text-[22px] font-semibold">{v}</dd>
    </div>
  );
}

function TimeRow({ at, label }: { at: string | null; label: string }) {
  if (!at) return null;
  return (
    <li className="flex justify-between gap-3 py-1.5 text-[13.5px]">
      <span>{label}</span>
      <span className="fp-num text-[var(--fp-muted)]">{clockTime(at)}</span>
    </li>
  );
}

/* FC handling note for one piece ("pack with garment sleeve", "ask about
   the fit"). Shown on the card once saved; emptying the field clears it. */
function NoteEditor({ initial, saving, onSave }: { initial: string; saving: boolean; onSave: (note: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  if (!editing) {
    return (
      <div className="mt-4">
        {initial ? (
          <p className="rounded-lg bg-[#faf7f2] px-3 py-2 text-[13.5px] text-[#57534e]">
            <strong className="font-semibold">Tagged:</strong> {initial}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => { setDraft(initial); setEditing(true); }}
          className="mt-2 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-[var(--fp-muted)] hover:text-[var(--fp-ink)]"
        >
          {initial ? "Edit note" : "Add a note for this piece"}
        </button>
      </div>
    );
  }
  return (
    <div className="mt-4">
      <label htmlFor="piece-note" className="text-[13px] font-semibold text-[#44403c]">Note for this piece</label>
      <textarea
        id="piece-note"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        maxLength={500}
        autoFocus
        placeholder="e.g. Pack with garment sleeve"
        className="mt-1.5 w-full rounded-lg border border-[var(--fp-line-strong)] bg-white px-3 py-2 text-[14.5px] text-[var(--fp-ink)] placeholder:text-[var(--fp-faint)] focus:border-[var(--fp-ink)] focus:outline-none"
      />
      <div className="mt-2 flex gap-2">
        <Btn
          tone="brand"
          disabled={saving || draft.trim() === initial.trim()}
          onClick={() => { onSave(draft.trim()); setEditing(false); }}
        >
          {saving ? "Saving…" : "Save note"}
        </Btn>
        <Btn tone="quiet" onClick={() => { setDraft(initial); setEditing(false); }}>Cancel</Btn>
      </div>
    </div>
  );
}

function ProductIdentity({
  name, nameHi, sku, size, colour, price, imageUrl, compact, href,
}: {
  name: string; nameHi?: ReactNode; sku: string; size: string; colour: string; price: number; imageUrl?: string | null; compact?: boolean; href?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- catalogue photos come from per-project storage hosts
        <img src={imageUrl} alt="" className="size-12 shrink-0 object-cover" />
      ) : (
        <span aria-hidden className="grid size-12 shrink-0 place-items-center bg-[var(--fp-ink-soft)] text-[15px] font-semibold text-[var(--fp-muted)]">{name.slice(0, 1)}</span>
      )}
      <div className="min-w-0">
        {href ? (
          <Link href={href} aria-label={`Open ${name} details`} className="truncate font-semibold tracking-tight underline decoration-[var(--fp-line-strong)] decoration-1 underline-offset-2 hover:decoration-[var(--fp-ink)]">
            <span className={`block truncate ${compact ? "text-[14px]" : "text-[16px]"}`}>{nameHi ?? name}</span>
          </Link>
        ) : (
          <p className={`truncate font-semibold tracking-tight ${compact ? "text-[14px]" : "text-[16px]"}`}>{nameHi ?? name}</p>
        )}
        <p className="mt-0.5 font-mono text-[12px] text-[var(--fp-faint)]">{sku}</p>
        <p className="mt-0.5 text-[13px] text-[var(--fp-muted)]">
          {size} · {colour} · <span className="fp-num font-semibold text-[var(--fp-ink)]">{formatINR(price)}</span>
        </p>
      </div>
    </div>
  );
}

const EDGE: Record<ProductVisitStatus, string> = {
  SELECTED: "border-l-[#cfc6bb]",
  TRIAL_IN_PROGRESS: "border-l-[var(--fp-brand)]",
  TRIAL_COMPLETED: "border-l-[#2e6b4f]",
  LIKED: "border-l-[#2e6b4f]",
  DROPPED: "border-l-[#cfc6bb]",
  PURCHASED: "border-l-[#23403a]",
};

function StatePill({ status }: { status: ProductVisitStatus }) {
  if (status === "TRIAL_IN_PROGRESS" || status === "TRIAL_COMPLETED") {
    const active = status === "TRIAL_IN_PROGRESS";
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide ${active ? "bg-[var(--fp-brand-soft)] text-[var(--fp-brand)]" : "bg-[#eef2ee] text-[#43544c]"}`}>
        {active && <span aria-hidden className="size-1.5 rounded-full bg-[var(--fp-brand)]" />} Trial
      </span>
    );
  }
  if (status === "LIKED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f2ea] px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-[#1c6b46]">
        Liked (Ready for billing)
      </span>
    );
  }
  if (status === "PURCHASED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#23403a] px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-white">
        Billed
      </span>
    );
  }
  if (status === "DROPPED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1ece4] px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-[#57534e]">
        Dropped
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1ece4] px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-[#57534e]">
      Selected
    </span>
  );
}

/* One uniform action style for every product action (Trial, Like, Drop, Bill,
   Complete, Cancel, Undo …) — same color for all of them, per the floor spec.
   No per-action colors: the busy state is enough of a signal. */
function ConsoleBtn({ children, onClick, disabled, type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-[#23403a] px-4 text-[13.5px] font-bold text-white transition-all hover:bg-[#1a312c] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function ProductRow({
  card, busy, onOpen, onTrial, onLike, onUnlike, onDrop, onUndrop, onBill,
  selectable, checked, onToggle, readOnly,
}: {
  card: ProductCardDTO;
  busy: string | null;
  onOpen: () => void;
  onTrial: () => void;
  onLike: () => void;
  onUnlike: () => void;
  onDrop: () => void;
  onUndrop: () => void;
  onBill: () => void;
  selectable?: boolean;
  checked?: boolean;
  onToggle?: () => void;
  readOnly?: boolean;
}) {
  const p = card.product;
  const dropped = card.status === "DROPPED";
  return (
    <article className={`rounded-xl border border-[#e9e2d8] border-l-4 ${EDGE[card.status]} bg-white p-3 sm:p-4`}>
      <div className="flex gap-3 sm:gap-4">
        <button type="button" onClick={onOpen} className="relative block w-24 shrink-0 self-start sm:w-[120px]" aria-label={`Open ${p.name}`}>
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- catalogue photos come from per-project storage hosts
            <img src={p.imageUrl} alt="" loading="lazy" decoding="async" className="aspect-[3/4] w-full rounded-lg bg-[#f1ece4] object-cover" />
          ) : (
            <span aria-hidden className="grid aspect-[3/4] w-full place-items-center rounded-lg bg-[#f1ece4] text-[28px] font-bold text-[#a8a094]">{p.name.slice(0, 1)}</span>
          )}
          <span title={`SKU ${p.sku} — tap details to copy`} className="absolute left-1.5 top-1.5 max-w-[80px] truncate rounded bg-white/95 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#57534e] sm:max-w-[112px]">SKU {p.sku}</span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
            <StatePill status={card.status} />
            <p className={`fp-num shrink-0 text-[17px] font-bold tracking-tight text-[#211d18] ${dropped ? "line-through opacity-60" : ""}`}>{formatINR(p.price)}</p>
          </div>
          <Link href={`/products/${p.id}`} className="mt-1.5 block w-full text-left" aria-label={`Open ${p.name} details`}>
            <h3 className="line-clamp-2 text-[16.5px] font-bold leading-snug tracking-tight text-[#211d18] underline decoration-[#cfc6bb] decoration-1 underline-offset-2 hover:decoration-[#211d18]">{p.name}</h3>
          </Link>
          <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-[#57534e]">
            <span className="truncate font-mono text-[12px]" title={p.sku}>{p.sku}</span>
            <span aria-hidden>·</span>
            <strong className="shrink-0 font-semibold">Size {p.size}</strong>
            <span aria-hidden>·</span>
            <span className="min-w-0 flex-1 basis-16 truncate">{p.colour}</span>
            <button
              type="button"
              onClick={() => { void navigator.clipboard?.writeText(p.sku).catch(() => {}); }}
              aria-label={`Copy SKU ${p.sku}`}
              title="Copy full SKU"
              className="grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-md text-[12px] text-[#a8a094] hover:bg-[#f1ece4] hover:text-[#211d18]"
            >
              <span aria-hidden>⧉</span>
            </button>
          </p>
          {card.status === "TRIAL_IN_PROGRESS" && card.timeline.trialStartedAt && (
            <p className="mt-1 text-[12.5px] text-[#7a736a]">Trying now · started {ago(card.timeline.trialStartedAt)}</p>
          )}
          {card.staffNote && (
            <p className="mt-2 rounded-lg bg-[#faf7f2] px-2.5 py-1.5 text-[12.5px] text-[#57534e]">
              <strong className="font-semibold">Tagged:</strong> {card.staffNote}
            </p>
          )}
          {dropped && (
            <p className="mt-2 rounded-lg bg-[#faf7f2] px-2.5 py-1.5 text-[12.5px] text-[#57534e]">
              <strong className="font-semibold">Client Feedback:</strong>{" "}
              {[card.dropReason?.label, card.dropSubcategory, card.note].filter(Boolean).join(" — ") || "No reason recorded"}
            </p>
          )}
          {card.status === "PURCHASED" && (
            <p className="fp-num mt-2 text-[12.5px] font-semibold text-[#1c6b46]">
              {card.billNumber ? `Bill ${card.billNumber}` : "Billed"}
              {card.timeline.purchasedAt ? ` · ${ago(card.timeline.purchasedAt)}` : ""}
            </p>
          )}
        </div>
      </div>
      {!readOnly && (
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#f1ece4] pt-3">
        {selectable && (
          <button
            role="checkbox"
            aria-checked={!!checked}
            aria-label={`Select ${p.name} for combined bill`}
            onClick={onToggle}
            className={`grid min-h-[44px] min-w-[44px] place-items-center rounded-lg border transition-colors ${checked ? "border-[#23403a] bg-[#23403a] text-white" : "border-[#e0d7c9] bg-white hover:border-[#211d18]"}`}
          >
            <span aria-hidden className={`grid size-5 place-items-center rounded ${checked ? "bg-white/15" : "bg-transparent"}`}>
              {checked ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 8.5 6.5 12 13 4" />
                </svg>
              ) : (
                <span className="block size-5 rounded border border-[#e0d7c9]" />
              )}
            </span>
          </button>
        )}
        {card.status === "SELECTED" && (
          <>
            <ConsoleBtn disabled={busy === `start-${card.id}`} onClick={onTrial}>
              {busy === `start-${card.id}` ? "Starting…" : "Trial"}
            </ConsoleBtn>
            <ConsoleBtn disabled={busy === `like-${card.id}`} onClick={onLike}>
              {busy === `like-${card.id}` ? "Saving…" : "Like"}
            </ConsoleBtn>
            <ConsoleBtn onClick={onDrop}>Drop</ConsoleBtn>
            <ConsoleBtn onClick={onBill}>Bill</ConsoleBtn>
          </>
        )}
        {card.status === "TRIAL_IN_PROGRESS" && (
          <>
            <p className="mr-auto inline-flex items-center gap-1.5 text-[13px] text-[#57534e]">Client is currently trying this on</p>
            <ConsoleBtn disabled={busy === `complete-${card.id}`} onClick={onTrial}>
              {busy === `complete-${card.id}` ? "Saving…" : "Trial"}
            </ConsoleBtn>
            <ConsoleBtn onClick={onDrop}>Drop</ConsoleBtn>
            <ConsoleBtn onClick={onBill}>Bill</ConsoleBtn>
          </>
        )}
        {card.status === "TRIAL_COMPLETED" && (
          <>
            <ConsoleBtn onClick={onDrop}>Drop</ConsoleBtn>
            <ConsoleBtn disabled={busy === `like-${card.id}`} onClick={onLike}>
              {busy === `like-${card.id}` ? "Saving…" : "Like"}
            </ConsoleBtn>
            <ConsoleBtn onClick={onBill}>Bill</ConsoleBtn>
            <ConsoleBtn disabled={busy === `reopen-${card.id}`} onClick={onTrial}>
              {busy === `reopen-${card.id}` ? "Saving…" : "Trial"}
            </ConsoleBtn>
          </>
        )}
        {card.status === "LIKED" && (
          <>
            <ConsoleBtn onClick={onDrop}>Drop</ConsoleBtn>
            <ConsoleBtn disabled={busy === `bill-${card.id}`} onClick={onBill}>
              {busy === `bill-${card.id}` ? "Saving…" : "Mark billed"}
            </ConsoleBtn>
            <ConsoleBtn disabled={busy === `unlike-${card.id}`} onClick={onUnlike}>
              {busy === `unlike-${card.id}` ? "Saving…" : "Unlike"}
            </ConsoleBtn>
          </>
        )}
        {card.status === "DROPPED" && (
          <ConsoleBtn disabled={busy === `undrop-${card.id}`} onClick={onUndrop}>
            {busy === `undrop-${card.id}` ? "Saving…" : "Undo drop"}
          </ConsoleBtn>
        )}
      </div>)}
    </article>
  );
}

export type { DropReason };
