import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { addWhatsAppLog, getWhatsAppLogs } from "@/features/customers/whatsapp";

/* GET /api/customers/:id/whatsapp — manual WhatsApp follow-up log.
   POST — { body, direction?: outgoing|incoming|note, visitId? } */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const data = await getWhatsAppLogs(auth, id, Number.isFinite(limit) ? limit : 20);
    return NextResponse.json({ data });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const data = await addWhatsAppLog(auth, id, {
      body: String(body.body ?? ""),
      direction: body.direction as "outgoing" | "incoming" | "note" | undefined,
      visitId: body.visitId ? String(body.visitId) : null,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
