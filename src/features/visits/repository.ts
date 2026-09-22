import { createClient } from "@/lib/supabase/server";
import type { VisitStatus } from "./types";

/* Canonical Stage 2 state machine (§10–12). UI mirrors this in src/lib/domain.ts. */
const TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  ARRIVED: ["IDENTIFYING", "CANCELLED"],
  IDENTIFYING: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: VisitStatus, to: VisitStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export interface VisitRow {
  id: string;
  status: VisitStatus;
  store_id: string;
  customer_id: string | null;
  assigned_salesperson_id: string | null;
  arrived_at: string;
  identified_at: string | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  /** Fitting suite (SUITE_01/02/03, SALON_VIP) — null until assigned. */
  suite: string | null;
}

export function toDTO(v: VisitRow) {
  return {
    id: v.id, status: v.status, storeId: v.store_id, customerId: v.customer_id,
    assignedSalespersonId: v.assigned_salesperson_id,
    arrivedAt: v.arrived_at, identifiedAt: v.identified_at,
    assignedAt: v.assigned_at, startedAt: v.started_at,
    completedAt: v.completed_at,
    suite: v.suite ?? null,
  };
}

export async function getVisitRow(visitId: string): Promise<VisitRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("visits").select("*").eq("id", visitId).single();
  return (data as VisitRow | null) ?? null;
}

export async function getTimeline(visitId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visit_events")
    .select("id, event_type, actor_id, metadata, created_at")
    .eq("visit_id", visitId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((e) => ({
    id: e.id, eventType: e.event_type, actorId: e.actor_id,
    metadata: e.metadata, createdAt: e.created_at,
  }));
}
