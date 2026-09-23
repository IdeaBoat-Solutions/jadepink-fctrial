import { z } from "zod";
import { normalizeName } from "@/lib/domain";
import { isValidPhoneIN, normalizePhone } from "@/lib/phone";

/* Single source of truth for customer validation — client AND server.
   Both create surfaces (the visit identify form and the directory card)
   safeParse with this schema before calling the store, so the rules can
   never drift apart again. */

// A name that is only digits is a searched mobile leaking into the name
// field — reject it rather than registering a customer named after their
// phone number.
const customerName = z
  .string()
  .trim()
  .min(2, "Name needs at least 2 characters")
  .max(120)
  .transform((v) => normalizeName(v))
  .refine((v) => /[a-zA-Z\u0900-\u097F]/.test(v), {
    message: "Name must contain letters — a mobile number is not a name",
  });

const customerPhone = z
  .string()
  .trim()
  .min(7, "Phone required")
  .max(20)
  .transform((v) => normalizePhone(v))
  .refine((v) => isValidPhoneIN(v), {
    message: "Enter a valid 10-digit mobile number",
  });

export const createCustomerSchema = z.object({
  name: customerName,
  phone: customerPhone,
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  city: z.string().trim().max(80).optional(),
  area: z.string().trim().max(80).optional(),
  budget: z.string().trim().max(40).optional(),
  source: z.string().trim().max(40).default("Walk-in"),
});

export const searchCustomerSchema = z.object({
  phone: z.string().trim().min(3).max(20),
});

/* One vocabulary for "how they found us" + budget, shared by every create
   surface (visit identify form, customers directory). New labels are added
   here once — never hardcoded into a second dropdown that can drift. */
export const CUSTOMER_SOURCES = ["Walk-in", "Instagram", "Meta Lead", "Referral", "Google", "Friend", "Other"] as const;

export const CUSTOMER_BUDGETS = ["Under ₹5k", "₹5–15k", "₹15–30k", "₹30k+"] as const;

export const updateCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name needs at least 2 characters")
    .max(120)
    .transform((v) => normalizeName(v))
    .optional(),
  phone: z.string().trim().min(7, "Phone required").max(20).optional(),
  area: z.string().trim().max(80).optional(),
  budget: z.string().trim().max(40).optional(),
  source: z.string().trim().max(40).optional(),
  tier: z.enum(["Silver", "Gold"]).nullable().optional(),
}).refine((o) => o.name !== undefined || o.phone !== undefined || o.source !== undefined || o.area !== undefined || o.budget !== undefined || o.tier !== undefined, {
  message: "Change at least one field",
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
