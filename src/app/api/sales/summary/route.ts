import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { listOrdersSince } from "@/features/catalogue/repository";
import { startOfISTDayISO } from "@/features/visits/service";

const EMPTY = {
  today: { orders: 0, revenue: 0 },
  week: { orders: 0, revenue: 0, byFc: [] as Array<{ name: string; orders: number; revenue: number }> },
};

/* GET /api/sales/summary — billed sales for today + the last 7 days, plus the
   7-day split by FC as recorded on the bills. Cancelled bills never count.
   Before the backend is connected this returns source "none" with zeros —
   the UI says so plainly instead of inventing numbers. */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ source: "none", ...EMPTY });
  }
  try {
    await requireAuth();
    const dayStart = new Date(startOfISTDayISO()).getTime();
    const weekStart = dayStart - 6 * 24 * 3600 * 1000;
    const rows = await listOrdersSince(new Date(weekStart).toISOString());
    const live = rows.filter((o) => o.status !== "cancelled");

    const todayRows = live.filter((o) => new Date(o.createdAt).getTime() >= dayStart);
    const byFc = new Map<string, { orders: number; revenue: number }>();
    for (const o of live) {
      const key = o.fcName || "Billed without FC";
      const cur = byFc.get(key) ?? { orders: 0, revenue: 0 };
      cur.orders += 1;
      cur.revenue += o.total;
      byFc.set(key, cur);
    }

    return NextResponse.json({
      source: "db",
      today: {
        orders: todayRows.length,
        revenue: todayRows.reduce((s, o) => s + o.total, 0),
      },
      week: {
        orders: live.length,
        revenue: live.reduce((s, o) => s + o.total, 0),
        byFc: [...byFc.entries()]
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.revenue - a.revenue),
      },
    });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
