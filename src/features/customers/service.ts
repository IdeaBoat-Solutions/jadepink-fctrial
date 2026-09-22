import { createClient } from "@/lib/supabase/server";
import { normalizePhone, formatPhoneIN, isValidPhoneIN } from "@/lib/phone";
import { Stage2Error, STAGE2_ERRORS } from "@/lib/errors";
import { isManagerRole } from "@/lib/policy";
import type { AuthContext } from "@/lib/authz";
import { findByNormalizedPhone } from "./repository";
import type { CustomerSnapshot } from "./types";
import type { CreateCustomerInput, UpdateCustomerInput } from "./schemas";

/* searchCustomer (§19): normalize → query → snapshot. No events recorded for searches. */
export async function searchCustomer(phone: string): Promise<CustomerSnapshot | null> {
  const norm = normalizePhone(phone);
  if (norm.length < 3) return null;
  const supabase = await createClient();
  const c = await findByNormalizedPhone(norm);
  if (!c) {
    // Fallback: partial match for pasted/partial numbers (UI debounced search).
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, mobile, visits, purchases, area, budget, source, tier")
      .or(`normalized_phone.ilike.%${norm}%,mobile.ilike.%${norm}%`)
      .limit(1)
      .single();
    // Never swallow DB errors as "not found" — a bad column/RLS must be loud.
    if (error && error.code !== "PGRST116") console.error("[searchCustomer] supabase error", error.code, error.message);
    if (!data) return null;
    return { id: data.id, name: data.name, phone: data.mobile, visitCount: data.visits, lastVisitAt: null, purchaseCount: data.purchases, area: data.area ?? null, budget: data.budget ?? null, source: data.source ?? null, tier: (data.tier as string | null) ?? null };
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
    area: (c as { area?: string | null }).area ?? null,
    budget: (c as { budget?: string | null }).budget ?? null,
    source: (c as { source?: string | null }).source ?? null,
    tier: (c as { tier?: string | null }).tier ?? null,
  };
}

/* searchCustomersByName: "Priya Shah" may be two different people — return
   every close match (newest cap 8) so staff picks by mobile + history,
   never a silent single guess. */
export async function searchCustomersByName(name: string): Promise<CustomerSnapshot[]> {
  const needle = name.trim().replace(/[%_\\]/g, "").slice(0, 60);
  if (needle.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, mobile, visits, purchases, area, budget, source, tier")
    .ilike("name", `%${needle}%`)
    .order("visits", { ascending: false })
    .limit(8);
  // Never swallow DB errors as "no match" — a bad column/RLS must be loud.
  if (error) console.error("[searchCustomersByName] supabase error", error.code, error.message);
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.mobile,
    visitCount: c.visits,
    lastVisitAt: null,
    purchaseCount: c.purchases,
    area: (c as { area?: string | null }).area ?? null,
    budget: (c as { budget?: string | null }).budget ?? null,
    source: (c as { source?: string | null }).source ?? null,
    tier: (c as { tier?: string | null }).tier ?? null,
  }));
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
      area: input.area?.trim() ? input.area.trim().slice(0, 80) : null,
      budget: input.budget?.trim() ? input.budget.trim().slice(0, 40) : null,
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

export async function updateCustomer(auth: AuthContext, customerId: string, input: UpdateCustomerInput) {
  /* Managers own the directory: correcting a name, a mistyped mobile or the
     source stays a manager action so the floor record stays trustworthy. */
  if (!isManagerRole(auth.role)) {
    throw new Stage2Error(STAGE2_ERRORS.FORBIDDEN, "Only a manager can edit customer records", 403);
  }
  const supabase = await createClient();
  const { data: current } = await supabase.from("customers").select("id").eq("id", customerId).single();
  if (!current) throw new Stage2Error(STAGE2_ERRORS.CUSTOMER_NOT_FOUND, "Customer not found", 404);

  const patch: { name?: string; mobile?: string; normalized_phone?: string; source?: string; area?: string | null; budget?: string | null; tier?: string | null } = {};
  if (input.name !== undefined) {
    if (!input.name.trim()) throw new Stage2Error(STAGE2_ERRORS.INVALID_PHONE, "Name required", 422);
    patch.name = input.name.trim();
  }
  if (input.phone !== undefined) {
    const norm = normalizePhone(input.phone);
    if (!isValidPhoneIN(input.phone)) {
      throw new Stage2Error(STAGE2_ERRORS.INVALID_PHONE, "Enter a valid 10-digit mobile number", 422);
    }
    const clash = await findByNormalizedPhone(norm);
    if (clash && clash.id !== customerId) {
      throw new Stage2Error(STAGE2_ERRORS.CUSTOMER_ALREADY_EXISTS, "Phone already registered", 409);
    }
    patch.mobile = norm;
    patch.normalized_phone = norm;
  }
  if (input.source !== undefined) patch.source = input.source.trim().slice(0, 40) || "Walk-in";
  if (input.area !== undefined) patch.area = input.area.trim().slice(0, 80) || null;
  if (input.budget !== undefined) patch.budget = input.budget.trim().slice(0, 40) || null;
  if (input.tier !== undefined) patch.tier = input.tier;

  const { data: updated, error } = await supabase
    .from("customers")
    .update(patch)
    .eq("id", customerId)
    .select("id, name, mobile, tier")
    .single();
  if (error || !updated) {
    const msg = String(error?.message ?? "");
    if (error?.code === "23505" || msg.includes("duplicate key")) {
      throw new Stage2Error(STAGE2_ERRORS.CUSTOMER_ALREADY_EXISTS, "Phone already registered", 409);
    }
    throw new Stage2Error(STAGE2_ERRORS.INVALID_PHONE, "Could not save changes", 422);
  }
  return { id: updated.id as string, name: updated.name as string, phone: updated.mobile as string, tier: (updated.tier as string | null) ?? null };
}

/* deleteCustomer: manager-only, and only for records with no history.
   A customer with visits or bills is a business record — the FKs would
   refuse anyway; this reports why in human words first. Duplicate records
   created by mistake (no visits, no orders) delete cleanly. */
export async function deleteCustomer(auth: AuthContext, customerId: string) {
  if (!isManagerRole(auth.role)) {
    throw new Stage2Error(STAGE2_ERRORS.FORBIDDEN, "Only a manager can delete customer records", 403);
  }
  const supabase = await createClient();
  const { data: current } = await supabase.from("customers").select("id, name").eq("id", customerId).single();
  if (!current) throw new Stage2Error(STAGE2_ERRORS.CUSTOMER_NOT_FOUND, "Customer not found", 404);

  const [{ count: visitCount }, { count: orderCount }, { data: live }] = await Promise.all([
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("customer_id", customerId),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", customerId),
    supabase.from("visits").select("id").eq("customer_id", customerId).in("status", ["ARRIVED", "IDENTIFYING", "ASSIGNED", "ACTIVE"]).limit(1),
  ]);
  if ((live ?? []).length > 0) {
    throw new Stage2Error(
      STAGE2_ERRORS.CUSTOMER_HAS_HISTORY,
      `${(current as { name: string }).name} is in the store right now — finish or end the visit first.`,
      409,
    );
  }
  const visits = visitCount ?? 0;
  const orders = orderCount ?? 0;
  if (visits > 0 || orders > 0) {
    const bits = [
      visits > 0 ? `${visits} visit${visits > 1 ? "s" : ""}` : null,
      orders > 0 ? `${orders} bill${orders > 1 ? "s" : ""}` : null,
    ].filter(Boolean).join(" and ");
    throw new Stage2Error(
      STAGE2_ERRORS.CUSTOMER_HAS_HISTORY,
      `${(current as { name: string }).name} has ${bits} on record — customer history is never deleted.`,
      409,
    );
  }

  const { error } = await supabase.from("customers").delete().eq("id", customerId);
  if (error) throw new Stage2Error(STAGE2_ERRORS.OPERATION_FAILED, "Could not delete the record — check the connection and try again.");
  return { id: customerId };
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
    area: c.area ?? null,
    budget: c.budget ?? null,
    source: c.source ?? null,
    tier: (c.tier as string | null) ?? null,
  };
}
