import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { attachCustomerToVisit, getVisit } from "@/features/visits/service";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const data = await getVisit(auth, id);
    return NextResponse.json({ data });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // POST /api/visits/[id] with { action: "attach", customerId } — explicit op, no PATCH (§11).
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    if (body.action !== "attach" || !body.customerId) {
      return NextResponse.json({ code: "INVALID_VISIT_STATE", message: "Use { action: 'attach', customerId }" }, { status: 422 });
    }
    const data = await attachCustomerToVisit(auth, id, String(body.customerId));
    return NextResponse.json({ data });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
