import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { attachCustomerToVisit } from "@/features/visits/service";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    if (!body.customerId) return NextResponse.json({ code: "CUSTOMER_REQUIRED", message: "customerId required" }, { status: 422 });
    const data = await attachCustomerToVisit(auth, id, String(body.customerId));
    return NextResponse.json({ data });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
