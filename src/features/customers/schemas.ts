import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, "Name needs at least 2 characters").max(120),
  phone: z.string().min(7, "Phone required").max(20),
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  city: z.string().trim().max(80).optional(),
  source: z.string().trim().max(40).default("Walk-in"),
});

export const searchCustomerSchema = z.object({
  phone: z.string().trim().min(3).max(20),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
