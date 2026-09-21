import { NextResponse } from "next/server";
import { listOrders } from "@/features/catalogue/repository";
import { orderSchema } from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parsePage, parsePageSize } from "@/lib/pagination";

/* GET /api/orders — real orders, mapped to the camelCase Order DTO with their
   line items attached. Previously this returned raw snake_case rows (so a caller
   typed against Order got undefined fields) and fell back to a fixture list. */
export async function GET(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ source: "none", data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
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
    return NextResponse.json({ error: "Invalid order", issues: parsed.error.flatten() }, { status: 400 });
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
      return NextResponse.json({ source: "db", data: { ...order, items } }, { status: 201 });
    } catch (e) {
      return NextResponse.json({ error: "DB write failed", detail: String(e) }, { status: 500 });
    }
  }
  const total = 0;
  return NextResponse.json({ source: "seed-echo", data: { id: `o-${Date.now()}`, code: "JP-9XXX", ...v, total, status: "pending" } }, { status: 201 });
}
