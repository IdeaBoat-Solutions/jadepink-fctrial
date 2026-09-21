import { createClient } from "@/lib/supabase/server";
import { normalizePhone, formatPhoneIN, isValidPhoneIN } from "@/lib/phone";
import { Stage2Error, STAGE2_ERRORS } from "@/lib/errors";
import type { AuthContext } from "@/lib/authz";
import { findByNormalizedPhone } from "./repository";
import type { CustomerSnapshot } from "./types";
import type { CreateCustomerInput } from "./schemas";

/* searchCustomer (§19): normalize → query → snapshot. No events recorded for searches. */
export async function searchCustomer(phone: string): Promise<CustomerSnapshot | null> {
  const norm = normalizePhone(phone);
  if (norm.length < 3) return null;
  const supabase = await createClient();
  const c = await findByNormalizedPhone(norm);
  if (!c) {
    // Fallback: partial match for pasted/partial numbers (UI debounced search).
    const { data } = await supabase
      .from("customers")
      .select("id, name, mobile, visits, purchases")
      .or(`normalized_phone.ilike.%${norm}%,mobile.ilike.%${norm}%`)
      .limit(1)
      .single();
    if (!data) return null;
    return { id: data.id, name: data.name, phone: data.mobile, visitCount: data.visits, lastVisitAt: null, purchaseCount: data.purchases };
  }
  const { data: last } = await supabase
    .from("visits")
    .select("created_at")
    .eq("customer_id", c.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return {
    id: c.id,
    name: c.name,
    phone: c.mobile,
    visitCount: c.visits,
    lastVisitAt: last?.created_at ?? null,
    purchaseCount: c.purchases,
  };
}

/* createCustomer (§20): UNIQUE(normalized_phone) is the final guard against races.
   Service pre-checks for a friendly error; constraint + catch handles the race. */
export async function createCustomer(auth: AuthContext, input: CreateCustomerInput) {
  void auth;
  const norm = normalizePhone(input.phone);
  if (!isValidPhoneIN(input.phone)) {
    throw new Stage2Error(STAGE2_ERRORS.INVALID_PHONE, "Enter a valid 10-digit mobile number", 422);
  }
  if (!input.name.trim()) throw new Stage2Error(STAGE2_ERRORS.INVALID_PHONE, "Name required", 422);
  const existing = await findByNormalizedPhone(norm);
  if (existing) {
    throw new Stage2Error(STAGE2_ERRORS.CUSTOMER_ALREADY_EXISTS, "Phone already registered", 409);
  }
  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("customers")
    .insert({
      name: input.name.trim(),
      mobile: norm,
      normalized_phone: norm,
      email: input.email ?? null,
      city: input.city ?? null,
      source: input.source ?? "Walk-in",
    })
    .select("id, name")
    .single();
  if (error || !created) {
    const msg = String(error?.message ?? "");
    if (error?.code === "23505" || msg.includes("duplicate key")) {
      throw new Stage2Error(STAGE2_ERRORS.CUSTOMER_ALREADY_EXISTS, "Phone already registered", 409);
    }
    throw new Stage2Error(STAGE2_ERRORS.INVALID_PHONE, "Could not save customer", 422);
  }
  return { id: created.id, name: created.name, phone: formatPhoneIN(norm), normalizedPhone: norm };
}

export async function getCustomerSnapshot(_auth: AuthContext, customerId: string): Promise<CustomerSnapshot> {
  const supabase = await createClient();
  const { data: c } = await supabase.from("customers").select("*").eq("id", customerId).single();
  if (!c) throw new Stage2Error(STAGE2_ERRORS.CUSTOMER_NOT_FOUND, "Customer not found", 404);
  const { data: last } = await supabase
    .from("visits")
    .select("created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return {
    id: c.id,
    name: c.name,
    phone: c.mobile,
    visitCount: c.visits,
    lastVisitAt: last?.created_at ?? null,
    purchaseCount: c.purchases,
  };
}
