import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { assignSalesperson } from "@/features/assignments/service";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    if (!body.salespersonId) return NextResponse.json({ code: "SALESPERSON_REQUIRED", message: "salespersonId required" }, { status: 422 });
    const data = await assignSalesperson(auth, id, String(body.salespersonId));
    return NextResponse.json({ data });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
