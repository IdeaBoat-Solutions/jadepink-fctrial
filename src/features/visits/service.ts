import { createClient } from "@/lib/supabase/server";
import { Stage2Error, STAGE2_ERRORS } from "@/lib/errors";
import { assertStoreAccess, type AuthContext } from "@/lib/authz";
import { canTransition, getTimeline, toDTO, type VisitRow } from "./repository";

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
    metadata: { customer_id: customerId, previous_customer_id: visit.customer_id ?? null },
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
  // Roadmap Stage 3: drop-off reason is required on anything liked or trialled
  // but not billed. A close with outstanding pieces would silently lose the
  // vendor-report field — block it with the exact count so the UI can route
  // the FC back to the floor trial. SELECTED-only rows never started a trial
  // and do not block the close.
  const { count: outstanding } = await supabase
    .from("visit_products")
    .select("id", { count: "exact", head: true })
    .eq("visit_id", visitId)
    .in("status", ["LIKED", "TRIAL_IN_PROGRESS", "TRIAL_COMPLETED"]);
  if ((outstanding ?? 0) > 0) {
    throw new Stage2Error(
      STAGE2_ERRORS.VISIT_HAS_UNBILLED_ITEMS,
      `${outstanding} item${outstanding === 1 ? " is" : "s are"} still liked or trialled but not billed — mark each billed or dropped with a reason first`,
      422,
    );
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
  // Same guard as completeVisit: cancelling with liked/trialled pieces still
  // open would silently lose the vendor-report drop reasons. The FC must bill
  // each piece or drop it with a reason first — "End visit" stays for visits
  // with nothing trialled.
  const { count: outstanding } = await supabase
    .from("visit_products")
    .select("id", { count: "exact", head: true })
    .eq("visit_id", visitId)
    .in("status", ["LIKED", "TRIAL_IN_PROGRESS", "TRIAL_COMPLETED"]);
  if ((outstanding ?? 0) > 0) {
    throw new Stage2Error(
      STAGE2_ERRORS.VISIT_HAS_UNBILLED_ITEMS,
      `${outstanding} item${outstanding === 1 ? " is" : "s are"} still liked or trialled but not billed — mark each billed or dropped with a reason first`,
      422,
    );
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

/* Fitting suites (mockup "Direct Assignment Target"). Stored on the visit;
   every change is also a SUITE_ASSIGNED event so the timeline shows it. */
export const VISIT_SUITES = ["SUITE_01", "SUITE_02", "SUITE_03", "SALON_VIP"] as const;
export type VisitSuite = (typeof VISIT_SUITES)[number];

export const SUITE_LABELS: Record<VisitSuite, string> = {
  SUITE_01: "Suite 01",
  SUITE_02: "Suite 02",
  SUITE_03: "Suite 03",
  SALON_VIP: "Salon VIP",
};

export function suiteLabel(suite: string | null | undefined): string | null {
  if (!suite) return null;
  return (SUITE_LABELS as Record<string, string>)[suite] ?? suite;
}

export async function setVisitSuite(auth: AuthContext, visitId: string, suite: VisitSuite | null) {
  const supabase = await createClient();
  const { data: visit } = await supabase.from("visits").select("*").eq("id", visitId).single();
  if (!visit) throw new Stage2Error(STAGE2_ERRORS.VISIT_NOT_FOUND, "Visit not found", 404);
  assertStoreAccess(auth, (visit as VisitRow).store_id);
  if (visit.status === "COMPLETED" || visit.status === "CANCELLED") {
    throw new Stage2Error(STAGE2_ERRORS.VISIT_ALREADY_COMPLETED, "Visit is closed", 422);
  }
  if (suite !== null && !(VISIT_SUITES as readonly string[]).includes(suite)) {
    throw new Stage2Error(STAGE2_ERRORS.INVALID_VISIT_STATE, "Unknown suite", 422);
  }
  const { data: updated, error } = await supabase
    .from("visits")
    .update({ suite })
    .eq("id", visitId)
    .select("*")
    .single();
  if (error || !updated) throw new Stage2Error(STAGE2_ERRORS.INVALID_VISIT_STATE, "Could not assign suite", 422);
  await supabase.from("visit_events").insert({
    visit_id: visitId,
    event_type: "SUITE_ASSIGNED",
    actor_id: auth.userId,
    metadata: suite ? { suite } : {},
  });
  const [dto] = await enrichVisits(supabase, [updated as VisitRow]);
  return dto;
}

/* Runner request (mockup "Call Runner"). One tap, optional note — stored as a
   RUNNER_REQUESTED event with the current suite for context. No new table. */
export async function requestRunner(auth: AuthContext, visitId: string, note: string | null = null) {
  const supabase = await createClient();
  const { data: visit } = await supabase.from("visits").select("*").eq("id", visitId).single();
  if (!visit) throw new Stage2Error(STAGE2_ERRORS.VISIT_NOT_FOUND, "Visit not found", 404);
  assertStoreAccess(auth, (visit as VisitRow).store_id);
  if (visit.status === "COMPLETED" || visit.status === "CANCELLED") {
    throw new Stage2Error(STAGE2_ERRORS.VISIT_ALREADY_COMPLETED, "Visit is closed", 422);
  }
  const clean = (note ?? "").trim().slice(0, 200) || null;
  await supabase.from("visit_events").insert({
    visit_id: visitId,
    event_type: "RUNNER_REQUESTED",
    actor_id: auth.userId,
    metadata: { suite: (visit as VisitRow).suite ?? null, note: clean },
  });
  return { requested: true as const, suite: (visit as VisitRow).suite ?? null, note: clean };
}

/* Today's visits for one store (§10, §19): every operational status — not just
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

/* Full journey timeline for one visit (Stage 2 + Stage 3 product events).
   Store-scoped via parent visit; actor names + drop-reason labels resolved
   server-side so the UI renders human lines, never raw event names. */
export async function getVisitTimeline(auth: AuthContext, visitId: string) {
  const supabase = await createClient();
  const { data: visit } = await supabase.from("visits").select("*").eq("id", visitId).single();
  if (!visit) {
    throw new Stage2Error(STAGE2_ERRORS.VISIT_NOT_FOUND, "Visit not found", 404);
  }
  assertStoreAccess(auth, (visit as VisitRow).store_id);

  const rows = await getTimeline(visitId);

  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((v): v is string => !!v))];
  const actorNames = new Map<string, string>();
  if (actorIds.length) {
    const { data } = await supabase.from("staff_profiles").select("id, name").in("id", actorIds);
    for (const s of data ?? []) actorNames.set(s.id as string, s.name as string);
  }

  // Drop-reason labels for PRODUCT_DROPPED metadata (code → label).
  const reasonCodes = [
    ...new Set(
      rows
        .map((r) => (r.metadata as Record<string, unknown> | null)?.drop_reason_code)
        .filter((v): v is string => typeof v === "string"),
    ),
  ];
  const reasonLabels = new Map<string, string>();
  if (reasonCodes.length) {
    const { data } = await supabase.from("drop_reasons").select("code, label").in("code", reasonCodes);
    for (const r of data ?? []) reasonLabels.set(r.code as string, r.label as string);
  }

  return rows.map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const sku = typeof meta.sku === "string" ? meta.sku : null;
    const code = typeof meta.drop_reason_code === "string" ? meta.drop_reason_code : null;
    const label = code ? reasonLabels.get(code) ?? null : null;
    const bill = typeof meta.bill_number === "string" ? meta.bill_number : null;
    const suite = typeof meta.suite === "string" ? suiteLabel(meta.suite) : null;
    const note = typeof meta.note === "string" && meta.note.trim() ? meta.note.trim().slice(0, 120) : null;
    let detail: string | null;
    if (r.eventType === "PRODUCT_DROPPED" || r.eventType === "DROP_REASON_CAPTURED") {
      detail = [sku, label ? `Reason: ${label}` : null].filter(Boolean).join(" · ") || null;
    } else if (r.eventType === "PRODUCT_PURCHASED") {
      detail = [sku, bill ? `Bill ${bill}` : null].filter(Boolean).join(" · ") || null;
    } else if (r.eventType === "SUITE_ASSIGNED") {
      detail = suite ? `Moved to ${suite}` : "Suite cleared";
    } else if (r.eventType === "RUNNER_REQUESTED") {
      detail = [suite, note].filter(Boolean).join(" · ") || "Runner called";
    } else if (r.eventType === "PRODUCT_NOTE_UPDATED") {
      detail = [sku, note ? `Note: ${note}` : "Note cleared"].filter(Boolean).join(" · ") || null;
    } else {
      detail = sku;
    }
    return {
      id: r.id,
      type: r.eventType,
      at: r.createdAt,
      actorName: r.actorId ? actorNames.get(r.actorId) ?? undefined : undefined,
      detail,
    };
  });
}

/* Floor summaries: per-visit Stage 3 counters for the manager live floor.
   One query for today's operational visits + one narrow status query for
   their visit_products (RLS store-scoped). Counts derived, never stored. */
export async function listFloorSummaries(auth: AuthContext, storeId: string) {
  assertStoreAccess(auth, storeId);
  const supabase = await createClient();
  const { data: visits } = await supabase
    .from("visits")
    .select("*")
    .eq("store_id", storeId)
    .in("status", ["ARRIVED", "IDENTIFYING", "ASSIGNED", "ACTIVE"])
    .gte("created_at", startOfISTDayISO())
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (visits ?? []) as VisitRow[];
  const enriched = await enrichVisits(supabase, rows);
  if (rows.length === 0) return [];

  const ids = rows.map((v) => v.id);
  const { data: products } = await supabase
    .from("visit_products")
    .select("visit_id, status")
    .in("visit_id", ids);
  const counts = new Map<string, { selected: number; trialInProgress: number; trialCompleted: number; liked: number; dropped: number; purchased: number }>();
  for (const id of ids) {
    counts.set(id, { selected: 0, trialInProgress: 0, trialCompleted: 0, liked: 0, dropped: 0, purchased: 0 });
  }
  for (const p of (products ?? []) as Array<{ visit_id: string; status: string }>) {
    const c = counts.get(p.visit_id);
    if (!c) continue;
    switch (p.status) {
      case "SELECTED": c.selected++; break;
      case "TRIAL_IN_PROGRESS": c.trialInProgress++; break;
      case "TRIAL_COMPLETED": c.trialCompleted++; break;
      case "LIKED": c.liked++; break;
      case "DROPPED": c.dropped++; break;
      case "PURCHASED": c.purchased++; break;
    }
  }
  return enriched.map((v) => ({ visit: v, summary: counts.get(v.id) ?? { selected: 0, trialInProgress: 0, trialCompleted: 0, liked: 0, dropped: 0, purchased: 0 } }));
}
