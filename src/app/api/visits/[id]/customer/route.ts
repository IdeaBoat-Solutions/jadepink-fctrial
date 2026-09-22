import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { createCustomerAndAttach } from "@/features/visits/service";

/* POST /api/visits/[id]/customer — create a new customer record AND attach it
   to this visit in one atomic write. Replaces the old create → attach two-step
   that could leave an orphaned customer when the attach failed. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    if (!body.name || !body.phone) {
      return NextResponse.json({ code: "INVALID_INPUT", message: "name and phone are required" }, { status: 422 });
    }
    const data = await createCustomerAndAttach(auth, id, {
      name: String(body.name),
      phone: String(body.phone),
      source: body.source ? String(body.source) : undefined,
      area: body.area ? String(body.area) : undefined,
      budget: body.budget ? String(body.budget) : undefined,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
