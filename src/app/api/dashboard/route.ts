import { NextResponse } from "next/server";
import { getStockSummary, listOrders } from "@/features/catalogue/repository";
import { revenueByDay } from "@/lib/inventory";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const EMPTY = {
  revenue: 0, units: 0, low: 0, out: 0, orders: 0, skus: 0, stockValue: 0,
};

/* GET /api/dashboard — real KPIs + revenue series + the restock list.
   Aggregation happens in getStockSummary so this never ships the whole catalogue
   to the browser just to count it. */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ source: "none", kpis: EMPTY, revenue: [], lowStock: [] });
  }

  try {
    const [stock, orders] = await Promise.all([getStockSummary(), listOrders({ page: 1, pageSize: 1000 })]);
    const live = orders.items.filter((o) => o.status !== "cancelled");
    const revenue = live.reduce((s, o) => s + o.total, 0);

    return NextResponse.json({
      source: "db",
      kpis: {
        revenue,
        units: stock.units,
        low: stock.low,
        out: stock.out,
        orders: orders.total,
        skus: stock.skus,
        stockValue: stock.value,
      },
      revenue: revenueByDay(live),
      lowStock: stock.attention,
    });
  } catch (e) {
    return NextResponse.json({ source: "db", kpis: EMPTY, revenue: [], lowStock: [], error: String(e) }, { status: 500 });
  }
}
