"use server";

import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { attachCustomerSchema, createWalkInSchema, visitIdSchema } from "./schemas";
import { attachCustomerToVisit, cancelVisit, completeVisit, createWalkIn, getVisit, listTodayVisits, startVisit } from "./service";

export async function createWalkInAction(input: { storeId: string }) {
  try {
    const auth = await requireAuth();
    const parsed = createWalkInSchema.parse(input);
    const data = await createWalkIn(auth, parsed.storeId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function attachCustomerAction(input: { visitId: string; customerId: string }) {
  try {
    const auth = await requireAuth();
    const parsed = attachCustomerSchema.parse(input);
    const data = await attachCustomerToVisit(auth, parsed.visitId, parsed.customerId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function startVisitAction(input: { visitId: string }) {
  try {
    const auth = await requireAuth();
    const parsed = visitIdSchema.parse(input);
    const data = await startVisit(auth, parsed.visitId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function getVisitAction(visitId: string) {
  try {
    const auth = await requireAuth();
    const data = await getVisit(auth, visitId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function completeVisitAction(input: { visitId: string }) {
  try {
    const auth = await requireAuth();
    const parsed = visitIdSchema.parse(input);
    const data = await completeVisit(auth, parsed.visitId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function cancelVisitAction(input: { visitId: string }) {
  try {
    const auth = await requireAuth();
    const parsed = visitIdSchema.parse(input);
    const data = await cancelVisit(auth, parsed.visitId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function listActiveVisitsAction(storeId: string) {
  try {
    const auth = await requireAuth();
    const data = await listTodayVisits(auth, storeId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}
