import { z } from "zod";

export const createWalkInSchema = z.object({ storeId: z.string().min(1) });
export const attachCustomerSchema = z.object({ visitId: z.string().min(1), customerId: z.string().min(1) });
export const visitIdSchema = z.object({ visitId: z.string().min(1) });
