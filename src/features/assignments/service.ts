import { createClient } from "@/lib/supabase/server";
import { Stage2Error, STAGE2_ERRORS } from "@/lib/errors";
import { assertStoreAccess, assertCanAssign, type AuthContext } from "@/lib/authz";
import { canReassignVisit } from "@/lib/policy";
import { toDTO, type VisitRow } from "../visits/repository";

/* FC assignment (§22–23): 7 checks + same-store invariant + audit event. Idempotent (§31).
   Role rule: any active FC on the roster may take a walk-in — salespeople see
   and pick every FC account, not just themselves. Taking a visit that is
   already with a colleague is still a manager override, so two FCs cannot
   pull the same customer. */
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

  // Validate the target FC through the owner-privileged view — the base table's
  // RLS hides colleagues from FC callers, which made every colleague pick fail
  // with a false "Salesperson not found".
  const { data: sp, error: spErr } = await supabase
    .from("v_salespeople")
    .select("id, active, store_id")
    .eq("id", salespersonId)
    .single();
  if (spErr && spErr.code !== "PGRST116") {
    console.error("[assignSalesperson] roster lookup error", spErr.code, spErr.message);
    throw new Stage2Error(STAGE2_ERRORS.INVALID_VISIT_STATE, "Could not verify the FC", 500);
  }
  if (!sp) throw new Stage2Error(STAGE2_ERRORS.SALESPERSON_NOT_FOUND, "Salesperson not found", 404);
  if (!sp.active) throw new Stage2Error(STAGE2_ERRORS.SALESPERSON_NOT_AVAILABLE, "Salesperson inactive", 422);
  if (!sp.store_id || sp.store_id !== visit.store_id) {
    throw new Stage2Error(STAGE2_ERRORS.SALESPERSON_WRONG_STORE, "FC belongs to another store", 403);
  }

  // Idempotent retry: same FC, already ASSIGNED/ACTIVE → success, no duplicate event.
  if (visit.assigned_salesperson_id === salespersonId && (visit.status === "ASSIGNED" || visit.status === "ACTIVE")) {
    return toDTO(visit as VisitRow);
  }

  // Reassigning a visit away from another FC is a manager override (roadmap:
  // "the override is logged with who changed it"). An FC may still take an
  // unassigned visit themselves, but may not pull one off a colleague.
  const isReassign = !!visit.assigned_salesperson_id && visit.assigned_salesperson_id !== salespersonId;
  if (isReassign && !canReassignVisit(auth.role)) {
    throw new Stage2Error(STAGE2_ERRORS.FORBIDDEN, "This visit is already with another FC — a manager can reassign it", 403);
  }

  const patch: Record<string, unknown> = {
    assigned_salesperson_id: salespersonId,
    // Refresh on every real change so the round-robin rotation pointer
    // (most-recent assigned_at) tracks reassigns, not just first assigns.
    assigned_at: new Date().toISOString(),
  };
  if (visit.status === "IDENTIFYING" || visit.status === "ARRIVED") patch.status = "ASSIGNED";
  const { data: updated, error: updateErr } = await supabase.from("visits").update(patch).eq("id", visitId).select("*").single();
  if (updateErr || !updated) {
    console.error("[assignSalesperson] visit update error", updateErr?.code, updateErr?.message);
    throw new Stage2Error(STAGE2_ERRORS.INVALID_VISIT_STATE, "Could not assign the FC", 422);
  }
  const { error: eventErr } = await supabase.from("visit_events").insert({
    visit_id: visitId,
    event_type: isReassign ? "FC_REASSIGNED" : "FC_ASSIGNED",
    actor_id: auth.userId,
    metadata: { previous_salesperson_id: visit.assigned_salesperson_id, new_salesperson_id: salespersonId },
  });
  if (eventErr) {
    // Assignment already committed — log loudly, don't fail the user.
    console.error("[assignSalesperson] event insert failed", eventErr.code, eventErr.message);
  }
  return toDTO(updated as VisitRow);
}

/* Available FCs: active, same store. Load balancing stays in UI (fewest active visits).
   Reads the owner-privileged v_salespeople view, NOT staff_profiles directly:
   staff_profiles RLS lets an FC read only their own row, so querying the base
   table here would hand every FC a one-person roster (colleagues missing →
   "Salesperson not found" on pick, round-robin stuck on self). The view exists
   precisely for this read and is documented in supabase/README.md. */
export async function getAvailableSalespersons(auth: AuthContext, storeId: string) {
  assertStoreAccess(auth, storeId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_salespeople")
    .select("id, name, store_id, active")
    .eq("store_id", storeId)
    .order("name", { ascending: true });
  // Never swallow DB errors as an empty roster — a broken view/permission must
  // surface as a loud failure, not as "No salesperson is available to assign."
  if (error) {
    console.error("[getAvailableSalespersons] supabase error", error.code, error.message);
    throw new Stage2Error(STAGE2_ERRORS.INVALID_VISIT_STATE, "Could not load the FC roster", 500);
  }
  return (data ?? []).map((sp) => ({ id: sp.id, name: sp.name, storeId: sp.store_id, active: sp.active }));
}
