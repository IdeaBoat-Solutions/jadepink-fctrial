import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { requestRunner } from "@/features/visits/service";

/** POST /api/visits/[id]/runner — one-tap runner call, optional note. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = z.object({ note: z.string().max(200).optional() }).parse(body);
    const data = await requestRunner(auth, id, parsed.note ?? null);
    return NextResponse.json({ data });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
