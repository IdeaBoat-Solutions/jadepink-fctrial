import { createClient } from "@/lib/supabase/server";
import { Stage2Error, STAGE2_ERRORS } from "@/lib/errors";
import type { AuthContext } from "@/lib/authz";

/* Real purchase / trial history for a customer — replaces the empty
   seedHistory() stub. Aggregates visits + visit_products so lookup and
   the customer profile show what was trialled, liked, and billed. */

export interface HistoryItem {
  name: string;
  size: string;
  colour: string;
  verdict: "liked" | "purchased" | "rejected" | "trialled";
  billNumber?: string | null;
  price?: number | null;
}

export interface PastVisitHistory {
  id: string;
  dateLabel: string;
  arrivedAt: string;
  status: string;
  fcName: string;
  /** Per-visit budget (migration 230) — null until the FC captures one. */
  budget?: string | null;
  trialled: number;
  liked: number;
  purchased: number;
  billedValue: number;
  items: HistoryItem[];
}

function dateLabelIN(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function verdictOf(status: string): HistoryItem["verdict"] {
  if (status === "PURCHASED") return "purchased";
  if (status === "LIKED") return "liked";
  if (status === "DROPPED") return "rejected";
  return "trialled";
}

export async function getCustomerHistory(
  _auth: AuthContext,
  customerId: string,
  limit = 20,
): Promise<PastVisitHistory[]> {
  const supabase = await createClient();
  const { data: customer } = await supabase.from("customers").select("id").eq("id", customerId).maybeSingle();
  if (!customer) throw new Stage2Error(STAGE2_ERRORS.CUSTOMER_NOT_FOUND, "Customer not found", 404);

  const { data: visits, error: visitsError } = await supabase
    .from("visits")
    .select("id, status, arrived_at, assigned_salesperson_id, created_at, budget")
    .eq("customer_id", customerId)
    .order("arrived_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));

  // Tolerant of pre-230 databases: retry without the budget column.
  type VisitHistoryRow = {
    id: string;
    status: string;
    arrived_at: string | null;
    created_at: string;
    assigned_salesperson_id: string | null;
    budget?: string | null;
  };
  let rows = (visits ?? []) as VisitHistoryRow[];
  if (visitsError && /budget/i.test(visitsError.message ?? "")) {
    const retry = await supabase
      .from("visits")
      .select("id, status, arrived_at, assigned_salesperson_id, created_at")
      .eq("customer_id", customerId)
      .order("arrived_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 50));
    rows = (retry.data ?? []) as VisitHistoryRow[];
  }
  if (rows.length === 0) return [];

  const spIds = [...new Set(rows.map((v) => v.assigned_salesperson_id).filter(Boolean))] as string[];
  const spNames = new Map<string, string>();
  if (spIds.length) {
    // v_floor_team is owner-privileged: staff_profiles RLS hides colleagues
    // from FC callers, which would show "FC unassigned" for every other FC.
    const { data: sps } = await supabase.from("v_floor_team").select("id, name").in("id", spIds);
    for (const sp of sps ?? []) spNames.set(sp.id, sp.name);
  }

  const visitIds = rows.map((v) => v.id);
  const { data: products } = await supabase
    .from("visit_products")
    .select(
      "visit_id, status, bill_number, product_variants(size, colour, price, products(name))",
    )
    .in("visit_id", visitIds);

  type RawVp = {
    visit_id: string;
    status: string;
    bill_number: string | null;
    product_variants?:
      | {
          size?: string;
          colour?: string;
          price?: number | string;
          products?: { name?: string } | { name?: string }[] | null;
        }
      | {
          size?: string;
          colour?: string;
          price?: number | string;
          products?: { name?: string } | { name?: string }[] | null;
        }[]
      | null;
  };

  const byVisit = new Map<string, RawVp[]>();
  for (const p of (products ?? []) as RawVp[]) {
    const list = byVisit.get(p.visit_id) ?? [];
    list.push(p);
    byVisit.set(p.visit_id, list);
  }

  return rows.map((v) => {
    const items: HistoryItem[] = [];
    let trialled = 0;
    let liked = 0;
    let purchased = 0;
    let billedValue = 0;

    for (const p of byVisit.get(v.id) ?? []) {
      const variant = Array.isArray(p.product_variants) ? p.product_variants[0] : p.product_variants;
      const product = variant
        ? Array.isArray(variant.products)
          ? variant.products[0]
          : variant.products
        : null;
      const price = variant?.price != null ? Number(variant.price) : null;
      const status = p.status;

      if (
        status === "TRIAL_IN_PROGRESS" ||
        status === "TRIAL_COMPLETED" ||
        status === "LIKED" ||
        status === "DROPPED" ||
        status === "PURCHASED"
      ) {
        trialled += 1;
      }
      if (status === "LIKED" || status === "PURCHASED") liked += 1;
      if (status === "PURCHASED") {
        purchased += 1;
        if (price != null && !Number.isNaN(price)) billedValue += price;
      }

      // Skip bare SELECTED rows — they never reached the floor decision.
      if (status === "SELECTED") continue;

      items.push({
        name: product?.name ?? "Product",
        size: variant?.size ?? "—",
        colour: variant?.colour ?? "",
        verdict: verdictOf(status),
        billNumber: p.bill_number,
        price,
      });
    }

    return {
      id: v.id,
      dateLabel: dateLabelIN(v.arrived_at ?? v.created_at),
      arrivedAt: v.arrived_at ?? v.created_at,
      status: v.status,
      fcName: (v.assigned_salesperson_id && spNames.get(v.assigned_salesperson_id)) || "FC unassigned",
      budget: (v as { budget?: string | null }).budget ?? null,
      trialled,
      liked,
      purchased,
      billedValue,
      items,
    };
  });
}
