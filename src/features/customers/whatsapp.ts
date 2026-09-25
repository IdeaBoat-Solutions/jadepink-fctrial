import { createClient } from "@/lib/supabase/server";
import { Stage2Error, STAGE2_ERRORS } from "@/lib/errors";
import { assertStoreAccess, type AuthContext } from "@/lib/authz";

export type WhatsAppDirection = "outgoing" | "incoming" | "note";

export interface WhatsAppLog {
  id: string;
  customerId: string;
  visitId: string | null;
  direction: WhatsAppDirection;
  body: string;
  createdAt: string;
}

/* Manual follow-up log shown next to visit history (migration 230).
   No WhatsApp Business API is wired yet — FCs log what happened on WhatsApp
   ("sent Hi", "customer replied", "shared catalogue") and deep-link to wa.me.
   Tolerant of pre-230 databases: missing table reads as "no logs yet". */
export async function getWhatsAppLogs(
  _auth: AuthContext,
  customerId: string,
  limit = 20,
): Promise<WhatsAppLog[]> {
  const supabase = await createClient();
  const { data: customer } = await supabase.from("customers").select("id").eq("id", customerId).maybeSingle();
  if (!customer) throw new Stage2Error(STAGE2_ERRORS.CUSTOMER_NOT_FOUND, "Customer not found", 404);

  const { data, error } = await supabase
    .from("whatsapp_logs")
    .select("id, customer_id, visit_id, direction, body, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error) throw new Stage2Error(STAGE2_ERRORS.OPERATION_FAILED, "Could not load WhatsApp history", 500);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    customerId: r.customer_id as string,
    visitId: (r.visit_id as string | null) ?? null,
    direction: (r.direction as WhatsAppDirection) ?? "outgoing",
    body: r.body as string,
    createdAt: r.created_at as string,
  }));
}

export async function addWhatsAppLog(
  auth: AuthContext,
  customerId: string,
  input: { body: string; direction?: WhatsAppDirection; visitId?: string | null },
): Promise<WhatsAppLog> {
  const supabase = await createClient();
  const { data: customer } = await supabase.from("customers").select("id").eq("id", customerId).maybeSingle();
  if (!customer) throw new Stage2Error(STAGE2_ERRORS.CUSTOMER_NOT_FOUND, "Customer not found", 404);

  if (input.visitId) {
    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .select("id, customer_id, store_id")
      .eq("id", input.visitId)
      .single();
    if (visitError || !visit || visit.customer_id !== customerId) {
      throw new Stage2Error(STAGE2_ERRORS.VISIT_NOT_FOUND, "Visit does not belong to this customer", 404);
    }
    assertStoreAccess(auth, visit.store_id);
  }

  const body = (input.body ?? "").trim().slice(0, 1000);
  if (!body) throw new Stage2Error(STAGE2_ERRORS.INVALID_PHONE, "Write what happened on WhatsApp first", 422);
  const direction: WhatsAppDirection =
    input.direction === "incoming" || input.direction === "note" ? input.direction : "outgoing";

  const { data, error } = await supabase
    .from("whatsapp_logs")
    .insert({
      customer_id: customerId,
      visit_id: input.visitId ?? null,
      direction,
      body,
      created_by: auth.userId,
    })
    .select("id, customer_id, visit_id, direction, body, created_at")
    .single();
  if (error || !data) {
    throw new Stage2Error(
      STAGE2_ERRORS.INVALID_VISIT_STATE,
      "Could not save the WhatsApp note — run migration 230 in Supabase first",
      422,
    );
  }
  return {
    id: data.id as string,
    customerId: data.customer_id as string,
    visitId: (data.visit_id as string | null) ?? null,
    direction: (data.direction as WhatsAppDirection) ?? "outgoing",
    body: data.body as string,
    createdAt: data.created_at as string,
  };
}
