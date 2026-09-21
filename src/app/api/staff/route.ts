import { NextResponse } from "next/server";
import { SEED_SALESPEOPLE } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/* GET /api/staff?role=FC|STORE_MANAGER|all — reads role views, falls back to seeds.
   Views: v_salespeople (FCs), v_store_managers, v_floor_team */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const role = (searchParams.get("role") || "all").toUpperCase();

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const view = role === "FC" ? "v_salespeople" : role === "STORE_MANAGER" ? "v_store_managers" : "v_floor_team";
      const { data: rows, error } = await supabase.from(view).select("*");
      if (!error && rows) {
        return NextResponse.json({ source: `db:view:${view}`, data: rows });
      }
      // views not installed yet (020_security.sql not run) — fall back to table
      const { data: profiles } = await supabase.from("staff_profiles").select("*").limit(50);
      if (profiles) return NextResponse.json({ source: "db:staff_profiles", data: profiles });
    } catch { /* seed fallback */ }
  }
  return NextResponse.json({ source: "seed", data: SEED_SALESPEOPLE });
}
