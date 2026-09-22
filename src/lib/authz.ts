import { createClient } from "@/lib/supabase/server";
import { Stage2Error, STAGE2_ERRORS } from "@/lib/errors";

export type Role = "FC" | "STORE_MANAGER" | "ADMIN" | "MANAGEMENT";

export interface AuthContext {
  userId: string;
  email: string | null;
  role: Role;
  storeId: string | null;
  name: string;
}

/** Resolve Supabase user → staff_profiles row. Throws UNAUTHORIZED/FORBIDDEN. */
export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Stage2Error(STAGE2_ERRORS.UNAUTHORIZED, "Sign in required");
  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("id, email, name, role, store_id, active")
    .eq("id", user.id)
    .single();
  if (!profile || !profile.active) throw new Stage2Error(STAGE2_ERRORS.FORBIDDEN, "Staff profile inactive");
  return {
    userId: profile.id,
    email: profile.email,
    role: profile.role as Role,
    storeId: profile.store_id,
    name: profile.name,
  };
}

/** Store scoping: non-admin callers must belong to the visit's store. */
export function assertStoreAccess(auth: AuthContext, storeId: string) {
  if (auth.role === "ADMIN" || auth.role === "MANAGEMENT") return;
  if (!auth.storeId || auth.storeId !== storeId) {
    throw new Stage2Error(STAGE2_ERRORS.FORBIDDEN, "No access to this store");
  }
}

export function assertCanAssign(auth: AuthContext) {
  // MANAGEMENT has cross-store oversight (see is_manager() in SQL) — the client
  // already shows them assign controls, so the server must not 403 them here.
  if (auth.role === "FC" || auth.role === "STORE_MANAGER" || auth.role === "ADMIN" || auth.role === "MANAGEMENT") return;
  throw new Stage2Error(STAGE2_ERRORS.FORBIDDEN, "Role cannot assign FCs");
}
