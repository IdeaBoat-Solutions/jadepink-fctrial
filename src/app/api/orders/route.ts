import { NextResponse } from "next/server";
import { listOrders, mapOrder } from "@/features/catalogue/repository";
import { orderSchema } from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parsePage, parsePageSize } from "@/lib/pagination";

/* GET /api/orders — real orders, mapped to the camelCase Order DTO with their
   line items attached. Previously this returned raw snake_case rows (so a caller
   typed against Order got undefined fields) and fell back to a fixture list. */
export async function GET(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ source: "none", data: [], total: 0, page: 1, pageSize: 20, totalPages: 1, start: 0, end: 0 });
  }
  const { searchParams } = new URL(req.url);
  try {
    const r = await listOrders({
      page: parsePage(searchParams.get("page")),
      pageSize: parsePageSize(searchParams.get("pageSize")),
      status: searchParams.get("status") ?? undefined,
    });
    return NextResponse.json({ source: "db", data: r.items, ...r });
  } catch (e) {
    return NextResponse.json({ source: "db", data: [], error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.flatten();
    const first = issues.formErrors[0] ?? Object.values(issues.fieldErrors).flat()[0] ?? "Check the order details.";
    return NextResponse.json({ code: "INVALID_ORDER", message: first, issues }, { status: 400 });
  }
  const v = parsed.data;
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data: products } = await supabase
        .from("products")
        .select("id, name, price")
        .in("id", v.items.map((it) => it.productId));
      const byId = new Map((products ?? []).map((p) => [p.id, p]));
      const total = v.items.reduce((s, it) => s + (byId.get(it.productId)?.price ?? 0) * it.qty, 0);
      const code = `JP-${Math.floor(9000 + Math.random() * 900)}`;
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          code,
          customer_name: v.customerName,
          customer_phone: v.customerPhone,
          total,
          channel: v.channel,
        })
        .select("*")
        .single();
      if (orderErr || !order) throw new Error(orderErr?.message ?? "order insert failed");
      const { data: items, error: itemsErr } = await supabase
        .from("order_items")
        .insert(
          v.items.map((it) => ({
            order_id: order.id,
            product_id: it.productId,
            product_name: byId.get(it.productId)?.name ?? it.productId,
            qty: it.qty,
            price: byId.get(it.productId)?.price ?? 0,
          }))
        )
        .select("*");
      if (itemsErr) throw new Error(itemsErr.message);
      // Map through the shared DTO so the client gets the same camelCase Order
      // shape the list endpoint serves, not raw inserted rows.
      const dto = mapOrder({ ...(order as Record<string, unknown>), order_items: items } as Parameters<typeof mapOrder>[0]);
      return NextResponse.json({ source: "db", data: dto }, { status: 201 });
    } catch (e) {
      return NextResponse.json({ code: "DB_WRITE_FAILED", message: "Could not save the order.", detail: String(e) }, { status: 500 });
    }
  }
  // No Supabase: refuse rather than echo a fabricated success — an order the
  // operator believes was saved but never was is worse than a clear failure.
  return NextResponse.json({ code: "NOT_CONFIGURED", message: "Order storage is not available." }, { status: 503 });
}
