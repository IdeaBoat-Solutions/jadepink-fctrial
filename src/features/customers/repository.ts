import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";
import type { CustomerSnapshot } from "./types";

/* Data access — no business rules here. Services own validation + auth. */

export async function findByNormalizedPhone(normalized: string) {
  // Never query with an empty key: .eq(col, "") would match junk blank rows
  // and surface them as a "found" customer card.
  if (!normalized || !normalized.trim()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*").eq("normalized_phone", normalized).single();
  return data ?? null;
}

export async function searchByPhoneDigits(digits: string, take = 6) {
  const norm = normalizePhone(digits);
  if (norm.length < 3) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .or(`normalized_phone.ilike.%${norm}%,mobile.ilike.%${norm}%`)
    .order("created_at", { ascending: false })
    .limit(take);
  return data ?? [];
}

export async function snapshotFor(customerId: string): Promise<CustomerSnapshot | null> {
  const supabase = await createClient();
  const { data: c } = await supabase.from("customers").select("*").eq("id", customerId).single();
  if (!c) return null;
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
