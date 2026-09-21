import { z } from "zod";

export const assignSchema = z.object({ visitId: z.string().min(1), salespersonId: z.string().uuid() });
export type AssignInput = z.infer<typeof assignSchema>;
