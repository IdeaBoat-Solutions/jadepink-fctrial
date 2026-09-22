import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { setVisitSuite, VISIT_SUITES } from "@/features/visits/service";

/** POST /api/visits/[id]/suite — assign (or clear) the fitting suite. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = z
      .object({ suite: z.enum(VISIT_SUITES).nullable() })
      .parse({ suite: body.suite ?? null });
    const data = await setVisitSuite(auth, id, parsed.suite);
    return NextResponse.json({ data });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
