import { createClient } from "@/lib/supabase/server";
import { Stage2Error, STAGE2_ERRORS } from "@/lib/errors";
import { assertStoreAccess, assertCanAssign, type AuthContext } from "@/lib/authz";
import { toDTO, type VisitRow } from "../visits/repository";

/* FC assignment (§22–23): 7 checks + same-store invariant + audit event. Idempotent (§31). */
export async function assignSalesperson(auth: AuthContext, visitId: string, salespersonId: string) {
  assertCanAssign(auth);
  const supabase = await createClient();
  const { data: visit } = await supabase.from("visits").select("*").eq("id", visitId).single();
  if (!visit) throw new Stage2Error(STAGE2_ERRORS.VISIT_NOT_FOUND, "Visit not found", 404);
  assertStoreAccess(auth, visit.store_id);
  if (visit.status === "COMPLETED" || visit.status === "CANCELLED") {
    throw new Stage2Error(STAGE2_ERRORS.VISIT_ALREADY_COMPLETED, "Visit already closed", 422);
  }
  if (!visit.customer_id) throw new Stage2Error(STAGE2_ERRORS.CUSTOMER_REQUIRED, "Attach a customer first", 422);

  const { data: sp } = await supabase.from("staff_profiles").select("id, active, store_id").eq("id", salespersonId).single();
  if (!sp) throw new Stage2Error(STAGE2_ERRORS.SALESPERSON_NOT_FOUND, "Salesperson not found", 404);
  if (!sp.active) throw new Stage2Error(STAGE2_ERRORS.SALESPERSON_NOT_AVAILABLE, "Salesperson inactive", 422);
  if (!sp.store_id || sp.store_id !== visit.store_id) {
    throw new Stage2Error(STAGE2_ERRORS.SALESPERSON_WRONG_STORE, "FC belongs to another store", 403);
  }

  // Idempotent retry: same FC, already ASSIGNED/ACTIVE → success, no duplicate event.
  if (visit.assigned_salesperson_id === salespersonId && (visit.status === "ASSIGNED" || visit.status === "ACTIVE")) {
    return toDTO(visit as VisitRow);
  }

  const isReassign = !!visit.assigned_salesperson_id;
  const patch: Record<string, unknown> = {
    assigned_salesperson_id: salespersonId,
    assigned_at: visit.assigned_at ?? new Date().toISOString(),
  };
  if (visit.status === "IDENTIFYING" || visit.status === "ARRIVED") patch.status = "ASSIGNED";
  const { data: updated } = await supabase.from("visits").update(patch).eq("id", visitId).select("*").single();
  await supabase.from("visit_events").insert({
    visit_id: visitId,
    event_type: isReassign ? "FC_REASSIGNED" : "FC_ASSIGNED",
    actor_id: auth.userId,
    metadata: { previous_salesperson_id: visit.assigned_salesperson_id, new_salesperson_id: salespersonId },
  });
  return toDTO((updated ?? visit) as VisitRow);
}

export async function reassignSalesperson(auth: AuthContext, visitId: string, salespersonId: string) {
  if (auth.role !== "STORE_MANAGER" && auth.role !== "ADMIN") {
    throw new Stage2Error(STAGE2_ERRORS.FORBIDDEN, "Only managers reassign active visits", 403);
  }
  return assignSalesperson(auth, visitId, salespersonId);
}

/* Available FCs: active, same store. Load balancing stays in UI (fewest active visits). */
export async function getAvailableSalespersons(auth: AuthContext, storeId: string) {
  assertStoreAccess(auth, storeId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_profiles")
    .select("id, name, store_id, active")
    .eq("store_id", storeId)
    .eq("active", true)
    .eq("role", "FC")
    .order("name", { ascending: true });
  return (data ?? []).map((sp) => ({ id: sp.id, name: sp.name, storeId: sp.store_id, active: sp.active }));
}
