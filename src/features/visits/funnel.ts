import { createClient } from "@/lib/supabase/server";
import { assertStoreAccess, type AuthContext } from "@/lib/authz";
import { startOfISTDayISO } from "./service";

/* Stage 2→3 funnel metrics (roadmap dashboard):
   Footfall → Trial, Trial → Bill, Footfall → conversion, Billed value / visitor.
   Computed from today's visits + visit_products — never invented client-side. */

export interface FunnelMetrics {
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

const EMPTY: FunnelMetrics = {
  footfall: 0,
  trials: 0,
  billedVisits: 0,
  billedPieces: 0,
  billedValue: 0,
  footfallToTrialPct: null,
  trialToBillPct: null,
  footfallConversionPct: null,
  billedValuePerVisitor: 0,
};

function pct(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10; // one decimal
}

export async function getStoreFunnelToday(auth: AuthContext, storeId: string): Promise<FunnelMetrics> {
  assertStoreAccess(auth, storeId);
  const supabase = await createClient();
  const dayStart = startOfISTDayISO();

  const { data: visits } = await supabase
    .from("visits")
    .select("id, status")
    .eq("store_id", storeId)
    .gte("created_at", dayStart)
    .neq("status", "CANCELLED");

  const rows = visits ?? [];
  const footfall = rows.length;
  if (footfall === 0) return { ...EMPTY };

  const visitIds = rows.map((v) => v.id);
  const { data: products } = await supabase
    .from("visit_products")
    .select("visit_id, status, product_variants(price)")
    .in("visit_id", visitIds);

  type Raw = {
    visit_id: string;
    status: string;
    product_variants?: { price?: number | string } | { price?: number | string }[] | null;
  };

  const trialVisits = new Set<string>();
  const billedVisits = new Set<string>();
  let billedPieces = 0;
  let billedValue = 0;

  for (const p of (products ?? []) as Raw[]) {
    const status = p.status;
    if (
      status === "TRIAL_IN_PROGRESS" ||
      status === "TRIAL_COMPLETED" ||
      status === "LIKED" ||
      status === "DROPPED" ||
      status === "PURCHASED"
    ) {
      trialVisits.add(p.visit_id);
    }
    if (status === "PURCHASED") {
      billedVisits.add(p.visit_id);
      billedPieces += 1;
      const variant = Array.isArray(p.product_variants) ? p.product_variants[0] : p.product_variants;
      const price = variant?.price != null ? Number(variant.price) : 0;
      if (!Number.isNaN(price)) billedValue += price;
    }
  }

  const trials = trialVisits.size;
  const billed = billedVisits.size;

  return {
    footfall,
    trials,
    billedVisits: billed,
    billedPieces,
    billedValue,
    footfallToTrialPct: pct(trials, footfall),
    trialToBillPct: pct(billed, trials),
    footfallConversionPct: pct(billed, footfall),
    billedValuePerVisitor: footfall > 0 ? Math.round(billedValue / footfall) : 0,
  };
}
