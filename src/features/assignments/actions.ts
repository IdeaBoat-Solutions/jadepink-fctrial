"use server";

import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { assignSchema } from "./schemas";
import { assignSalesperson, getAvailableSalespersons, reassignSalesperson } from "./service";

export async function assignSalespersonAction(input: { visitId: string; salespersonId: string }) {
  try {
    const auth = await requireAuth();
    const parsed = assignSchema.parse(input);
    const data = await assignSalesperson(auth, parsed.visitId, parsed.salespersonId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function reassignSalespersonAction(input: { visitId: string; salespersonId: string }) {
  try {
    const auth = await requireAuth();
    const parsed = assignSchema.parse(input);
    const data = await reassignSalesperson(auth, parsed.visitId, parsed.salespersonId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function getAvailableSalespersonsAction(storeId: string) {
  try {
    const auth = await requireAuth();
    const data = await getAvailableSalespersons(auth, storeId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}
