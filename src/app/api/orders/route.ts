import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { listOrders, mapOrder } from "@/features/catalogue/repository";
import { orderSchema } from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parsePage, parsePageSize } from "@/lib/pagination";

/* GET /api/orders — real orders, mapped to the camelCase Order DTO with their
   line items attached. Previously this returned raw snake_case rows (so a caller
   typed against Order got undefined fields) and fell back to a fixture list. */
export async function GET(req: Request) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Sign in required." }, { status: 401 });
  }
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
  } catch {
    return NextResponse.json({ source: "db", data: [], error: "Could not load orders." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let auth;
  try {
    auth = await requireAuth();
  } catch {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Sign in required." }, { status: 401 });
  }
  if (auth.role === "FC") {
    return NextResponse.json({ code: "FORBIDDEN", message: "Only managers can create orders." }, { status: 403 });
  }
  if (!auth.storeId) {
    return NextResponse.json({ code: "STORE_REQUIRED", message: "Select a store before creating an order." }, { status: 409 });
  }
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
      const productIds = [...new Set(v.items.map((it) => it.productId))];
      const { data: products, error: productsErr } = await supabase
        .from("products")
        .select("id, name, price")
        .in("id", productIds);
      if (productsErr) throw new Error("product lookup failed");
      if (!products || products.length !== productIds.length) {
        return NextResponse.json({ code: "INVALID_ORDER", message: "One or more products no longer exist." }, { status: 400 });
      }
      const byId = new Map(products.map((p) => [p.id, p]));
      const total = v.items.reduce((s, it) => s + Number(byId.get(it.productId)?.price ?? 0) * it.qty, 0);
      const code = `JP-${Math.floor(9000 + Math.random() * 900)}`;
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          code,
          customer_name: v.customerName,
          customer_phone: v.customerPhone,
          total,
          channel: v.channel,
           store_id: auth.storeId,
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
      if (itemsErr) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error("order items insert failed");
      }
      // Map through the shared DTO so the client gets the same camelCase Order
      // shape the list endpoint serves, not raw inserted rows.
      const dto = mapOrder({ ...(order as Record<string, unknown>), order_items: items } as Parameters<typeof mapOrder>[0]);
      return NextResponse.json({ source: "db", data: dto }, { status: 201 });
    } catch {
      return NextResponse.json({ code: "DB_WRITE_FAILED", message: "Could not save the order." }, { status: 500 });
    }
  }
  // No Supabase: refuse rather than echo a fabricated success — an order the
  // operator believes was saved but never was is worse than a clear failure.
  return NextResponse.json({ code: "NOT_CONFIGURED", message: "Order storage is not available." }, { status: 503 });
}
