/* JadePink F.C. Trial — Stage 2 domain layer.
   Business event -> Domain state -> DB fact -> Operation -> UI state.
   This file is the single source of truth for entities, state machine,
   phone normalization, and pure business operations. UI must reflect it. */

export type VisitStatus =
  | "ARRIVED"
  | "IDENTIFYING"
  | "ASSIGNED"
  | "ACTIVE"
  | "ON_FLOOR" // Stage 3 entry point (handoff target)
  | "COMPLETED"
  | "ABANDONED";

export type FCStatus = "available" | "busy" | "offline";

export type VisitEventType =
  | "WALK_IN_RECORDED"
  | "CUSTOMER_IDENTIFIED"
  | "NEW_CUSTOMER_CREATED"
  | "FC_ASSIGNED"
  | "FC_REASSIGNED"
  | "VISIT_STARTED"
  | "VISIT_COMPLETED"
  | "VISIT_ABANDONED";

export interface Customer {
  id: string;
  name: string;
  /** normalized: last 10 digits for IN numbers */
  mobile: string;
  displayMobile: string;
  source?: string;
  preferredSize?: string;
  frequentLikes?: string[];
  visitsCount: number;
  purchasesCount: number;
  lastVisitLabel: string;
  avgSpend?: number;
  createdAt: string;
}

export interface Salesperson {
  id: string;
  name: string;
  status: FCStatus;
  role: "fc" | "manager" | "admin";
}

export interface VisitEvent {
  id: string;
  visitId: string;
  type: VisitEventType;
  at: string; // ISO
  actorName?: string;
  note?: string;
}

export interface Visit {
  id: string;
  storeId: string;
  storeName: string;
  customerId: string | null;
  salespersonId: string | null;
  status: VisitStatus;
  arrivalTime: string; // ISO
  startedAt: string | null;
  productCount: number;
  visitStageLabel: string; // human label: Selecting / Trial / Ready for billing...
  events: VisitEvent[];
}

export interface PastVisitSummary {
  id: string;
  dateLabel: string;
  fcName: string;
  trialled: number;
  liked: number;
  purchased: number;
  items?: { name: string; size: string; verdict: "liked" | "purchased" | "rejected" }[];
}

/* ---------- Phone normalization ---------- */

export function normalizeMobile(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  // Keep last 10 digits (handles +91, 0 prefix, spaces)
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

export function formatMobileIN(normalized: string): string {
  const d = normalizeMobile(normalized);
  if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  if (!d) return "";
  return `+91 ${d}`;
}

export function isValidMobileIN(raw: string): boolean {
  const d = normalizeMobile(raw);
  return /^[6-9]\d{9}$/.test(d);
}

/* ---------- Person-name normalization ----------
   Customers may be recorded with a single name — the mobile number is what
   keeps same-named people apart on the floor (full name still required for
   STAFF registration only). */

export function normalizeName(raw: string): string {
  return (raw || "").trim().replace(/\s+/g, " ");
}

/** Full name = first name + surname at minimum ("Priya" alone is rejected). */
export function isFullName(raw: string): boolean {
  return normalizeName(raw).split(" ").length >= 2;
}

export const FULL_NAME_ERROR =
  "Enter first name + surname (e.g. Priya Shah) — one name alone mixes two different people up.";

/* ---------- Visit state machine ---------- */

const TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  ARRIVED: ["IDENTIFYING", "ABANDONED"],
  IDENTIFYING: ["ASSIGNED", "ABANDONED"],
  ASSIGNED: ["ACTIVE", "ABANDONED"],
  ACTIVE: ["ON_FLOOR", "COMPLETED", "ABANDONED"],
  ON_FLOOR: ["COMPLETED", "ABANDONED"],
  COMPLETED: [],
  ABANDONED: [],
};

export function canTransition(from: VisitStatus, to: VisitStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextAllowedStatuses(s: VisitStatus): VisitStatus[] {
  return TRANSITIONS[s] ?? [];
}

export function statusLabel(s: VisitStatus): string {
  switch (s) {
    case "ARRIVED": return "Arrived";
    case "IDENTIFYING": return "Identifying customer";
    case "ASSIGNED": return "FC assigned";
    case "ACTIVE": return "Active visit";
    case "ON_FLOOR": return "On the floor";
    case "COMPLETED": return "Completed";
    case "ABANDONED": return "Abandoned";
  }
}

/** UI must never show contradictory states. Guard used by store + UI. */
export function visitContradiction(v: Visit): string | null {
  if ((v.status === "ASSIGNED" || v.status === "ACTIVE" || v.status === "ON_FLOOR") && !v.salespersonId)
    return "This visit shows an assigned state but has no FC. Reassign before continuing.";
  if ((v.status === "ASSIGNED" || v.status === "ACTIVE" || v.status === "ON_FLOOR") && !v.customerId)
    return "This visit shows a customer state but has no customer attached. Identify the customer first.";
  if (v.status === "ACTIVE" && !v.startedAt)
    return "This visit is marked active but has no start time.";
  return null;
}

/* ---------- Staff roster ----------
    Fixture rosters were DELETED as unnecessary and misleading: 5 invented
    customers with plausible Indian mobile numbers, 3 fake walk-in visits,
    fabricated per-customer purchase history ("Trialled 8 / Liked 5 /
    Purchased 2" for ANY id) and the 2-entry SEED_SALESPEOPLE list all
    reached screens as though they were JadePink's real data.

    Real behavioural facts come from visits + visit_products + visit_events;
    the staff roster comes from GET /api/staff (role views over
    staff_profiles). Do not reintroduce fixtures. */

/* ---------- Pure search ---------- */

export function searchCustomers(customers: Customer[], raw: string): Customer[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const digits = normalizeMobile(raw);
  if (digits.length >= 4) {
    const byMobile = customers.filter((c) => c.mobile.includes(digits));
    if (byMobile.length) return byMobile;
  }
  return customers.filter(
    (c) => c.name.toLowerCase().includes(q) || c.mobile.includes(digits || "__none__")
  ).slice(0, 6);
}

/* ---------- Error helper (human, never technical) ---------- */

export function friendlyError(code: string): { title: string; body: string; action?: string } {
  switch (code) {
    case "DUPLICATE_MOBILE":
      return { title: "That mobile number is already registered.", body: "Open the existing customer instead of creating a duplicate.", action: "View existing customer" };
    case "INVALID_MOBILE":
      return { title: "Enter a valid 10-digit mobile number.", body: "Check the number and try again. The customer is waiting — keep it quick." };
    case "VISIT_COMPLETED":
      return { title: "This visit is already completed.", body: "Completed visits can't be reassigned. Start a new walk-in if the customer returned." };
    case "NO_CUSTOMER":
      return { title: "Attach a customer first.", body: "Search or create the customer before assigning an FC." };
    case "OFFLINE":
      return { title: "Connection lost. Nothing was saved.", body: "Your input is preserved. Reconnect and retry — do not re-enter everything." };
    default:
      return { title: "Something didn't save.", body: "Your work is preserved. Try again once." };
  }
}
