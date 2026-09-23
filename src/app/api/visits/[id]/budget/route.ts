import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { setVisitBudget } from "@/features/visits/service";

/* POST /api/visits/[id]/budget — per-visit budget (migration 230).
   Body: { budget: string }. Editable until the visit closes. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const data = await setVisitBudget(auth, id, body.budget !== undefined ? String(body.budget) : null);
    return NextResponse.json({ data });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
