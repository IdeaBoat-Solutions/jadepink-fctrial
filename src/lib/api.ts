/* Stage 2 live API client. Thin typed wrappers over the live route handlers.
   Every call returns { ok: true, data } | { ok: false, code, message } so the
   UI can map codes to human copy (§21) instead of catching JSON shape errors. */

import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import type { Category, Order, Product, Supplier } from "@/lib/inventory";


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

export const attachCustomer = (visitId: string, customerId: string) =>
  call<VisitLive>(`/api/visits/${visitId}/attach`, { method: "POST", body: JSON.stringify({ customerId }) });

export const assignFC = (visitId: string, salespersonId: string) =>
  call<VisitLive>(`/api/visits/${visitId}/assign`, { method: "POST", body: JSON.stringify({ salespersonId }) });

export const startVisit = (visitId: string) =>
  call<VisitLive>(`/api/visits/${visitId}/start`, { method: "POST" });

export const completeVisit = (visitId: string) =>
  call<VisitLive>(`/api/visits/${visitId}/complete`, { method: "POST" });

export const cancelVisit = (visitId: string) =>
  call<VisitLive>(`/api/visits/${visitId}/cancel`, { method: "POST" });

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

export interface UpdatedCustomer {
  id: string;
  name: string;
  phone: string;
}

export const updateCustomerRecord = (id: string, input: { name?: string; phone?: string; source?: string; area?: string; budget?: string }) =>
  call<UpdatedCustomer>(`/api/customers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

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

export const listProducts = (f: { q?: string; category?: string; stock?: string; page?: number; pageSize?: number } = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "" && v !== "all") p.set(k, String(v));
  return callBody<Paged<Product>>(`/api/products?${p.toString()}`);
};

export const listCategories = () => callBody<{ data: Category[] }>("/api/categories");
export const listSuppliers = () => callBody<{ data: Supplier[] }>("/api/suppliers");

export const listOrdersPage = (page = 1, pageSize = DEFAULT_PAGE_SIZE) =>
  callBody<Paged<Order>>(`/api/orders?page=${page}&pageSize=${pageSize}`);

export interface DashboardLive {
  source: string;
  kpis: { revenue: number; units: number; low: number; out: number; orders: number; skus: number; stockValue: number; suppliers: number };
  revenue: { day: string; revenue: number }[];
  lowStock: Array<Pick<Product, "id" | "sku" | "name" | "stock" | "lowStockAt">>;
}

export const getDashboard = () => callBody<DashboardLive>("/api/dashboard");
