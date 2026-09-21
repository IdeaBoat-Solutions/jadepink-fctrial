"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { createCustomerSchema } from "./schemas";
import { createCustomer, getCustomerSnapshot, searchCustomer } from "./service";

export async function searchCustomerAction(phone: string) {
  try {
    const auth = await requireAuth();
    void auth;
    const result = await searchCustomer(phone);
    return { ok: true as const, data: result };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function createCustomerAction(input: z.infer<typeof createCustomerSchema>) {
  try {
    const auth = await requireAuth();
    const parsed = createCustomerSchema.parse(input);
    const data = await createCustomer(auth, parsed);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function getCustomerSnapshotAction(customerId: string) {
  try {
    const auth = await requireAuth();
    const data = await getCustomerSnapshot(auth, customerId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}
