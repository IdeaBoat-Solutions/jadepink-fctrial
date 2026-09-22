import { z } from "zod";
import { FULL_NAME_ERROR, isFullName, normalizeName } from "@/lib/domain";

export const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name needs at least 2 characters")
    .max(120)
    .transform((v) => normalizeName(v))
    .refine((v) => isFullName(v), { message: FULL_NAME_ERROR }),
  phone: z.string().min(7, "Phone required").max(20),
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  city: z.string().trim().max(80).optional(),
  area: z.string().trim().max(80).optional(),
  budget: z.string().trim().max(40).optional(),
  source: z.string().trim().max(40).default("Walk-in"),
});

export const searchCustomerSchema = z.object({
  phone: z.string().trim().min(3).max(20),
});

export const updateCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name needs at least 2 characters")
    .max(120)
    .transform((v) => normalizeName(v))
    .refine((v) => isFullName(v), { message: FULL_NAME_ERROR })
    .optional(),
  phone: z.string().trim().min(7, "Phone required").max(20).optional(),
  area: z.string().trim().max(80).optional(),
  budget: z.string().trim().max(40).optional(),
  source: z.string().trim().max(40).optional(),
}).refine((o) => o.name !== undefined || o.phone !== undefined || o.source !== undefined || o.area !== undefined || o.budget !== undefined, {
  message: "Change at least one field",
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
