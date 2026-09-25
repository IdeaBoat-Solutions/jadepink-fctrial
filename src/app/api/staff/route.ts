import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const roleLabel = (role: string) =>
  role === "STORE_MANAGER" ? "Store Manager" : role === "FC" ? "Salesperson / FC" : "Admin";

/* GET /api/staff?role=FC|STORE_MANAGER|all — reads role views, falls back to the
   staff_profiles table when the views are not installed. No seed roster: an
   unconfigured database answers an empty list, never invented colleagues.
   Views: v_salespeople (FCs), v_store_managers, v_floor_team */
export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(req.url);
    const role = (searchParams.get("role") || "all").toUpperCase();

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const crossStore = auth.role === "ADMIN" || auth.role === "MANAGEMENT";
        if (!crossStore) {
          let query = supabase
            .from("staff_profiles")
            .select("*")
            .eq("store_id", auth.storeId ?? "")
            .eq("active", true)
            .limit(100);
          if (role === "FC" || role === "STORE_MANAGER") query = query.eq("role", role);
          const { data: profiles, error: profilesError } = await query;
          if (!profilesError && profiles) {
            return NextResponse.json({
              source: "db:staff_profiles",
              data: profiles.map((p) => ({ ...p, role_label: roleLabel(String(p.role ?? "")) })),
            });
          }
        } else {
          const view = role === "FC" ? "v_salespeople" : role === "STORE_MANAGER" ? "v_store_managers" : "v_floor_team";
          const { data: rows, error } = await supabase.from(view).select("*");
          if (!error && rows) {
            const data = rows.map((r) => ({
              ...r,
              role_label: (r as { role_label?: string }).role_label ?? roleLabel(String((r as { role?: string }).role ?? "")),
            }));
            return NextResponse.json({ source: `db:view:${view}`, data });
          }
        }
      } catch { /* fall through to the empty answer below */ }
    }
    return NextResponse.json({ source: "none", data: [] });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
