import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { getCustomerHistory } from "@/features/customers/history";

/* GET /api/customers/:id/history — past visits with trialled / liked / billed
   item summaries for Stage 2 lookup and the customer profile. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const data = await getCustomerHistory(auth, id, Number.isFinite(limit) ? limit : 20);
    return NextResponse.json({ data });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
