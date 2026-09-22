import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getStoreFunnelToday } from "@/features/visits/funnel";

const EMPTY = {
  footfall: 0,
  trials: 0,
  billedVisits: 0,
  billedPieces: 0,
  billedValue: 0,
  footfallToTrialPct: null as number | null,
  trialToBillPct: null as number | null,
  footfallConversionPct: null as number | null,
  billedValuePerVisitor: 0,
};

/* GET /api/visits/funnel?storeId=… — today's Footfall→Trial→Bill metrics. */
export async function GET(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ source: "none", data: EMPTY });
  }
  try {
    const auth = await requireAuth();
    const storeId = new URL(req.url).searchParams.get("storeId") || auth.storeId;
    if (!storeId) {
      return NextResponse.json({ code: "STORE_REQUIRED", message: "Store required" }, { status: 422 });
    }
    const data = await getStoreFunnelToday(auth, storeId);
    return NextResponse.json({ source: "db", data });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
