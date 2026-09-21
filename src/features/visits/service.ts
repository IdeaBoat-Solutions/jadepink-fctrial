import { createClient } from "@/lib/supabase/server";
import { Stage2Error, STAGE2_ERRORS } from "@/lib/errors";
import { assertStoreAccess, type AuthContext } from "@/lib/authz";
import { canTransition, toDTO, type VisitRow } from "./repository";

/* Start of the current day in IST (store timezone) — "today" for the
   dashboard/floor lists must follow the store's calendar, not UTC. */
export function startOfISTDayISO(): string {
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const istMidnightUTC = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate());
  return new Date(istMidnightUTC - 5.5 * 3600 * 1000).toISOString();
}

/* Enriched DTO: customer + FC names resolved server-side so the UI never
   depends on client-side caches to render a name (§36 database-aware UI). */
export type VisitDTOEnriched = ReturnType<typeof toDTO> & {
  customerName: string | null;
  fcName: string | null;
};

async function enrichVisits(supabase: Awaited<ReturnType<typeof createClient>>, rows: VisitRow[]): Promise<VisitDTOEnriched[]> {
  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter((v): v is string => !!v))];
  const spIds = [...new Set(rows.map((r) => r.assigned_salesperson_id).filter((v): v is string => !!v))];

  const customerNames = new Map<string, string>();
  if (customerIds.length) {
    const { data } = await supabase.from("customers").select("id, name").in("id", customerIds);
    for (const c of data ?? []) customerNames.set(c.id, c.name);
  }
  const spNames = new Map<string, string>();
  if (spIds.length) {
    const { data } = await supabase.from("staff_profiles").select("id, name").in("id", spIds);
    for (const sp of data ?? []) spNames.set(sp.id, sp.name);
  }
  return rows.map((v) => ({
    ...toDTO(v),
    customerName: v.customer_id ? customerNames.get(v.customer_id) ?? null : null,
    fcName: v.assigned_salesperson_id ? spNames.get(v.assigned_salesperson_id) ?? null : null,
  }));
}

/* createWalkIn (§18): visit (ARRIVED→IDENTIFYING) + WALK_IN_RECORDED event. */
export async function createWalkIn(auth: AuthContext, storeId: string) {
  const supabase = await createClient();
  const { data: store } = await supabase.from("stores").select("id, active").eq("id", storeId).single();
  if (!store || !store.active) throw new Stage2Error(STAGE2_ERRORS.FORBIDDEN, "Store unavailable", 403);
  assertStoreAccess(auth, storeId);

  const { data: created, error } = await supabase
    .from("visits")
    .insert({ store_id: storeId, status: "ARRIVED" })
    .select("*")
    .single();
  if (error || !created) throw new Stage2Error(STAGE2_ERRORS.INVALID_VISIT_STATE, "Could not record walk-in", 422);

  await supabase.from("visit_events").insert({
    visit_id: created.id, event_type: "WALK_IN_RECORDED", actor_id: auth.userId,
    metadata: { store_id: storeId },
  });
  // ARRIVED → IDENTIFYING immediately: arrival recorded, identification begins.
  const { data: moved } = await supabase
    .from("visits")
    .update({ status: "IDENTIFYING" })
    .eq("id", created.id)
    .select("*")
    .single();
  const [dto] = await enrichVisits(supabase, [(moved ?? created) as VisitRow]);
  return dto;
}

/* attachCustomerToVisit (§21): verify → link → IDENTIFYING + CUSTOMER_ATTACHED.
   First attach also increments the customer's visit count (bookkeeping, §42). */
export async function attachCustomerToVisit(auth: AuthContext, visitId: string, customerId: string) {
  const supabase = await createClient();
  const { data: visit } = await supabase.from("visits").select("*").eq("id", visitId).single();
  if (!visit) throw new Stage2Error(STAGE2_ERRORS.VISIT_NOT_FOUND, "Visit not found", 404);
  if (visit.status === "COMPLETED" || visit.status === "CANCELLED") {
    throw new Stage2Error(STAGE2_ERRORS.VISIT_ALREADY_COMPLETED, "Visit already closed", 422);
  }
  assertStoreAccess(auth, visit.store_id);
  const { data: customer } = await supabase.from("customers").select("id").eq("id", customerId).single();
  if (!customer) throw new Stage2Error(STAGE2_ERRORS.CUSTOMER_NOT_FOUND, "Customer not found", 404);

  const patch: Record<string, unknown> = { customer_id: customerId, identified_at: visit.identified_at ?? new Date().toISOString() };
  if (visit.status === "ARRIVED") patch.status = "IDENTIFYING";
  const { data: updated } = await supabase.from("visits").update(patch).eq("id", visitId).select("*").single();
  await supabase.from("visit_events").insert({
    visit_id: visitId, event_type: "CUSTOMER_ATTACHED", actor_id: auth.userId,
    metadata: { customer_id: customerId },
  });

  // First attach on this visit counts as a visit for the customer snapshot.
  if (!visit.customer_id) {
    const { data: cRow } = await supabase.from("customers").select("visits").eq("id", customerId).single();
    await supabase.from("customers").update({ visits: (cRow?.visits ?? 0) + 1 }).eq("id", customerId);
  }

  const [dto] = await enrichVisits(supabase, [(updated ?? visit) as VisitRow]);
  return dto;
}

export async function getVisit(auth: AuthContext, visitId: string) {
  const supabase = await createClient();
  const { data: visit } = await supabase.from("visits").select("*").eq("id", visitId).single();
  if (!visit) throw new Stage2Error(STAGE2_ERRORS.VISIT_NOT_FOUND, "Visit not found", 404);
  assertStoreAccess(auth, visit.store_id);
  const [dto] = await enrichVisits(supabase, [visit as VisitRow]);
  return dto;
}

/* startVisit (§24): only ASSIGNED → ACTIVE with customer + FC present. Idempotent (§31). */
export async function startVisit(auth: AuthContext, visitId: string) {
  const supabase = await createClient();
  const { data: visit } = await supabase.from("visits").select("*").eq("id", visitId).single();
  if (!visit) throw new Stage2Error(STAGE2_ERRORS.VISIT_NOT_FOUND, "Visit not found", 404);
  assertStoreAccess(auth, visit.store_id);
  if (visit.status === "ACTIVE") {
    const [dto] = await enrichVisits(supabase, [visit as VisitRow]);
    return dto; // idempotent retry
  }
  if (!visit.customer_id) throw new Stage2Error(STAGE2_ERRORS.CUSTOMER_REQUIRED, "Attach a customer first", 422);
  if (!visit.assigned_salesperson_id) throw new Stage2Error(STAGE2_ERRORS.SALESPERSON_REQUIRED, "Assign an FC first", 422);
  if (!canTransition(visit.status, "ACTIVE")) {
    throw new Stage2Error(STAGE2_ERRORS.INVALID_VISIT_STATE, `Cannot start from ${visit.status}`, 422);
  }
  const { data: updated } = await supabase
    .from("visits")
    .update({ status: "ACTIVE", started_at: visit.started_at ?? new Date().toISOString() })
    .eq("id", visitId)
    .select("*")
    .single();
  await supabase.from("visit_events").insert({
    visit_id: visitId, event_type: "VISIT_STARTED", actor_id: auth.userId, metadata: {},
  });
  const [dto] = await enrichVisits(supabase, [(updated ?? visit) as VisitRow]);
  return dto;
}

export async function completeVisit(auth: AuthContext, visitId: string) {
  const supabase = await createClient();
  const { data: visit } = await supabase.from("visits").select("*").eq("id", visitId).single();
  if (!visit) throw new Stage2Error(STAGE2_ERRORS.VISIT_NOT_FOUND, "Visit not found", 404);
  assertStoreAccess(auth, visit.store_id);
  if (visit.status === "COMPLETED") {
    const [dto] = await enrichVisits(supabase, [visit as VisitRow]);
    return dto;
  }
  if (!canTransition(visit.status, "COMPLETED")) {
    throw new Stage2Error(STAGE2_ERRORS.INVALID_VISIT_STATE, `Cannot complete from ${visit.status}`, 422);
  }
  const { data: updated } = await supabase
    .from("visits")
    .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
    .eq("id", visitId)
    .select("*")
    .single();
  await supabase.from("visit_events").insert({
    visit_id: visitId, event_type: "VISIT_COMPLETED", actor_id: auth.userId, metadata: {},
  });
  const [dto] = await enrichVisits(supabase, [(updated ?? visit) as VisitRow]);
  return dto;
}

export async function cancelVisit(auth: AuthContext, visitId: string) {
  const supabase = await createClient();
  const { data: visit } = await supabase.from("visits").select("*").eq("id", visitId).single();
  if (!visit) throw new Stage2Error(STAGE2_ERRORS.VISIT_NOT_FOUND, "Visit not found", 404);
  assertStoreAccess(auth, visit.store_id);
  if (visit.status === "CANCELLED" || visit.status === "COMPLETED") {
    const [dto] = await enrichVisits(supabase, [visit as VisitRow]);
    return dto;
  }
  const { data: updated } = await supabase
    .from("visits")
    .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
    .eq("id", visitId)
    .select("*")
    .single();
  await supabase.from("visit_events").insert({
    visit_id: visitId, event_type: "VISIT_CANCELLED", actor_id: auth.userId, metadata: {},
  });
  const [dto] = await enrichVisits(supabase, [(updated ?? visit) as VisitRow]);
  return dto;
}

/* Today's visits for one store (§10, §19): every operational status — not just
   active — so Today counts (walk-ins / active / completed / awaiting) and the
   Live Floor all derive from one honest query. CANCELLED is excluded: it is
   closed state, never shown on operational surfaces. */
export async function listTodayVisits(auth: AuthContext, storeId: string) {
  assertStoreAccess(auth, storeId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("visits")
    .select("*")
    .eq("store_id", storeId)
    .in("status", ["ARRIVED", "IDENTIFYING", "ASSIGNED", "ACTIVE", "COMPLETED"])
    .gte("created_at", startOfISTDayISO())
    .order("created_at", { ascending: false })
    .limit(200);
  return enrichVisits(supabase, (data ?? []) as VisitRow[]);
}
