/* Stage 2 live API client. Thin typed wrappers over the live route handlers.
   Every call returns { ok: true, data } | { ok: false, code, message } so the
   UI can map codes to human copy (§21) instead of catching JSON shape errors. */

import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import type { Category, Order, Product, StockMovement, Supplier } from "@/lib/inventory";


export interface VisitLive {
  id: string;
  status: "ARRIVED" | "IDENTIFYING" | "ASSIGNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  storeId: string;
  customerId: string | null;
  assignedSalespersonId: string | null;
  arrivedAt: string;
  identifiedAt: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  /** Per-visit budget (migration 230) — separate from the customer profile. */
  budget?: string | null;
  /** Fitting suite (SUITE_01/02/03, SALON_VIP) — null until assigned. */
  suite?: string | null;
  /** Resolved server-side so the UI never needs a client cache to show a name. */
  customerName?: string | null;
  fcName?: string | null;
}

export interface SalespersonLive {
  id: string;
  name: string;
  storeId: string;
  active: boolean;
}

export interface CustomerSnapshotLive {
  id: string;
  name: string;
  phone: string;
  visitCount: number;
  lastVisitAt: string | null;
  purchaseCount: number;
  area?: string | null;
  budget?: string | null;
  source?: string | null;
  tier: string | null;
}

export interface StaffProfile {
  id: string;
  name: string;
  role: "FC" | "STORE_MANAGER" | "ADMIN" | "MANAGEMENT";
  storeId: string | null;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

async function call<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, code: String(json.code ?? "INTERNAL"), message: String(json.message ?? "Request failed") };
    }
    // NB: explicit `null` payloads (e.g. { data: null } = "not found") must stay
    // null — `json.data ?? json` would promote them to a truthy `{}` and the UI
    // would render a blank record card. Only fall back when the key is absent.
    return { ok: true, data: ("data" in json ? json.data : json) as T };
  } catch {
    return { ok: false, code: "NETWORK", message: "Connection lost. Your changes haven't been saved." };
  }
}

/* ---------- Staff ---------- */

export const getMe = () =>
  call<{ user: { id: string; email?: string } | null; profile: StaffProfile | null }>("/api/staff/me");

/* ---------- Walk-ins / visits ---------- */

export const createWalkIn = (storeId: string) =>
  call<VisitLive>("/api/walk-ins", { method: "POST", body: JSON.stringify({ storeId }) });

export const listActiveVisits = (storeId: string) =>
  call<VisitLive[]>(`/api/visits?storeId=${encodeURIComponent(storeId)}`);

export const attachCustomer = (visitId: string, customerId: string, budget?: string) =>
  call<VisitLive>(`/api/visits/${visitId}/attach`, { method: "POST", body: JSON.stringify({ customerId, budget: budget || undefined }) });

export const setVisitBudget = (visitId: string, budget: string) =>
  call<VisitLive>(`/api/visits/${visitId}/budget`, { method: "POST", body: JSON.stringify({ budget }) });

export const assignFC = (visitId: string, salespersonId: string) =>
  call<VisitLive>(`/api/visits/${visitId}/assign`, { method: "POST", body: JSON.stringify({ salespersonId }) });

export const startVisit = (visitId: string) =>
  call<VisitLive>(`/api/visits/${visitId}/start`, { method: "POST" });

export const completeVisit = (visitId: string) =>
  call<VisitLive>(`/api/visits/${visitId}/complete`, { method: "POST" });

export const cancelVisit = (visitId: string) =>
  call<VisitLive>(`/api/visits/${visitId}/cancel`, { method: "POST" });

export const deleteVisitRecord = (visitId: string) =>
  call<{ id: string }>(`/api/visits/${visitId}`, { method: "DELETE" });

export const setVisitSuite = (visitId: string, suite: string | null) =>
  call<VisitLive>(`/api/visits/${visitId}/suite`, { method: "POST", body: JSON.stringify({ suite }) });

export const requestRunner = (visitId: string, note?: string) =>
  call<{ requested: boolean; suite: string | null; note: string | null }>(`/api/visits/${visitId}/runner`, {
    method: "POST",
    body: JSON.stringify({ note: note ?? undefined }),
  });

export interface FloorSummary {
  selected: number;
  trialInProgress: number;
  trialCompleted: number;
  liked: number;
  dropped: number;
  purchased: number;
}

export interface FloorVisit {
  visit: VisitLive & { customerName?: string | null; fcName?: string | null };
  summary: FloorSummary;
}

export const listFloorVisits = (storeId: string) =>
  call<FloorVisit[]>(`/api/visits/floor?storeId=${encodeURIComponent(storeId)}`);

export interface VisitTimelineEventLive {
  id: string;
  type: string;
  at: string;
  actorName?: string;
  detail?: string | null;
}

export const getVisitTimeline = (visitId: string) =>
  call<VisitTimelineEventLive[]>(`/api/visits/${visitId}/timeline`);

/* ---------- Customers ---------- */

export const searchCustomerByPhone = (phone: string) =>
  call<CustomerSnapshotLive | null>(`/api/customers/search?phone=${encodeURIComponent(phone)}`);

/* Name lookup returns every close match — one name may be two people, so the
   UI lists them with mobiles + history instead of guessing one. */
export const searchCustomersByName = (name: string) =>
  call<CustomerSnapshotLive[]>(`/api/customers/search?name=${encodeURIComponent(name)}`);

/* Single-record read. Needed because the client cache only holds customers that
   appear in today's visits — a direct URL, a reload or a link from history must
   be able to resolve the record from the database, not guess from memory. */
export const getCustomerById = (id: string) =>
  call<CustomerSnapshotLive>(`/api/customers/${encodeURIComponent(id)}`);

export interface PastVisitHistoryLive {
  id: string;
  dateLabel: string;
  arrivedAt: string;
  status: string;
  fcName: string;
  budget?: string | null;
  trialled: number;
  liked: number;
  purchased: number;
  billedValue: number;
  items: Array<{
    name: string;
    size: string;
    colour: string;
    verdict: "liked" | "purchased" | "rejected" | "trialled";
    billNumber?: string | null;
    price?: number | null;
  }>;
}

export const getCustomerHistory = (id: string, limit = 20) =>
  call<PastVisitHistoryLive[]>(
    `/api/customers/${encodeURIComponent(id)}/history?limit=${encodeURIComponent(String(limit))}`,
  );

/* ---------- WhatsApp follow-up log (manual, migration 230) ---------- */

export interface WhatsAppLogLive {
  id: string;
  customerId: string;
  visitId: string | null;
  direction: "outgoing" | "incoming" | "note";
  body: string;
  createdAt: string;
}

export const getWhatsAppLogs = (id: string, limit = 20) =>
  call<WhatsAppLogLive[]>(
    `/api/customers/${encodeURIComponent(id)}/whatsapp?limit=${encodeURIComponent(String(limit))}`,
  );

export const addWhatsAppLog = (id: string, input: { body: string; direction?: WhatsAppLogLive["direction"]; visitId?: string | null }) =>
  call<WhatsAppLogLive>(`/api/customers/${encodeURIComponent(id)}/whatsapp`, {
    method: "POST",
    body: JSON.stringify(input),
  });

/* wa.me deep-link helpers — used by the history contact icons. */
export function whatsAppDigits(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export function whatsAppLink(phone: string, text?: string): string {
  const digits = whatsAppDigits(phone);
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export interface FunnelMetricsLive {
  footfall: number;
  trials: number;
  billedVisits: number;
  billedPieces: number;
  billedValue: number;
  footfallToTrialPct: number | null;
  trialToBillPct: number | null;
  footfallConversionPct: number | null;
  billedValuePerVisitor: number;
}

export const getVisitFunnel = (storeId: string) =>
  call<FunnelMetricsLive>(`/api/visits/funnel?storeId=${encodeURIComponent(storeId)}`);

export const createCustomer = (input: { name: string; phone: string; source?: string; area?: string; budget?: string }) =>
  call<{ id: string; name: string; phone: string; normalizedPhone: string }>("/api/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });

/* Atomic create-customer-and-attach-to-visit. One round trip, one transaction:
   no orphaned customer record when the attach would have failed. */
export interface CreatedCustomerAndVisit {
  customer: { id: string; name: string; phone: string };
  visit: VisitLive;
}

export const createCustomerAndAttach = (
  visitId: string,
  input: { name: string; phone: string; source?: string; area?: string; budget?: string },
) =>
  call<CreatedCustomerAndVisit>(`/api/visits/${encodeURIComponent(visitId)}/customer`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export interface UpdatedCustomer {
  id: string;
  name: string;
  phone: string;
  tier: string | null;
}

export const updateCustomerRecord = (id: string, input: { name?: string; phone?: string; source?: string; area?: string; budget?: string; tier?: string | null }) =>
  call<UpdatedCustomer>(`/api/customers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const deleteCustomerRecord = (id: string) =>
  call<{ id: string }>(`/api/customers/${encodeURIComponent(id)}`, { method: "DELETE" });

/* ---------- Sales ---------- */

export interface SalesSummary {
  source: string;
  today: { orders: number; revenue: number };
  week: { orders: number; revenue: number; byFc: Array<{ name: string; orders: number; revenue: number }> };
}

export const getSalesSummary = () => call<SalesSummary>("/api/sales/summary");

/* ---------- Salespeople ---------- */

export const listSalespersons = (storeId: string) =>
  call<SalespersonLive[]>(`/api/salespersons?storeId=${encodeURIComponent(storeId)}`);

/* ---------- Catalogue + admin ----------
   The paged routes answer with an envelope ({ data, page, total, totalPages }),
   and a table needs those counts, so these unwrap the whole body rather than the
   bare `data` array that call() returns. */

async function callBody<T>(url: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, code: String(json.code ?? json.error ?? "INTERNAL"), message: String(json.message ?? json.error ?? "Request failed") };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, code: "NETWORK", message: "Connection lost. Nothing was lost — try again." };
  }
}

export interface Paged<T> {
  source: string;
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  start: number;
  end: number;
}

export const listProducts = (f: { q?: string; category?: string; stock?: string; supplier?: string; brand?: string; minPrice?: number | string; maxPrice?: number | string; sort?: string; page?: number; pageSize?: number } = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "" && v !== "all") p.set(k, String(v));
  return callBody<Paged<Product>>(`/api/products?${p.toString()}`);
};

export const listBrands = () => callBody<{ data: string[] }>("/api/brands");

export const listCategories = () => callBody<{ data: Category[] }>("/api/categories");
export const listSuppliers = () => callBody<{ data: Supplier[] }>("/api/suppliers");

export const listOrdersPage = (page = 1, pageSize = DEFAULT_PAGE_SIZE, status?: string) => {
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status && status !== "all") p.set("status", status);
  return callBody<Paged<Order>>(`/api/orders?${p.toString()}`);
};

/** Manual / remote order (instagram, website, meta-lead). The server recomputes
    the total from its own prices — the client total is a preview only. */
export const createOrder = (input: {
  customerName: string;
  customerPhone: string;
  channel?: Order["channel"];
  items: Array<{ productId: string; qty: number }>;
}) => call<Order>("/api/orders", { method: "POST", body: JSON.stringify(input) });

/* Exact product lookup for a scanned code. Answers barcode / company_barcode /
   SKU against `products` — SJ exports carry company_barcode on the product row,
   not on a variant, so an exact variant scan can miss a code this finds. */
export interface BarcodeProduct {
  id: string;
  sku: string;
  name: string;
  barcode?: string | null;
  company_barcode?: string | null;
}

export const lookupBarcode = (code: string) =>
  call<BarcodeProduct[]>(`/api/barcode?code=${encodeURIComponent(code)}`);

/** One product + its stock ledger in a single round trip. */
export interface ProductDetailLive {
  product: Product;
  movements: StockMovement[];
}

export const getProductDetail = (id: string) =>
  call<ProductDetailLive>(`/api/products/${encodeURIComponent(id)}`);

/* ---------- Floor team roster ---------- */

export interface StaffRosterRow {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  active?: boolean;
  /** From v_floor_team; the table fallback derives it from `role`. */
  role_label?: string;
}

export const listStaffRoster = () => call<StaffRosterRow[]>("/api/staff?role=all");

export interface DashboardLive {
  source: string;
  kpis: { revenue: number; units: number; low: number; out: number; orders: number; skus: number; stockValue: number; suppliers: number };
  revenue: { day: string; revenue: number }[];
  lowStock: Array<Pick<Product, "id" | "sku" | "name" | "stock" | "lowStockAt">>;
}

export const getDashboard = () => callBody<DashboardLive>("/api/dashboard");
