import { z } from "zod";

export const staffSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  roleLabel: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().max(240).optional().or(z.literal("")),
  workingHours: z.string().trim().max(160).optional().or(z.literal("")),
  compensation: z.string().trim().max(160).optional().or(z.literal("")),
  active: z.enum(["true", "false"]).default("true")
});

export const doctorSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(240).transform((value) => value.toLowerCase()),
  branchId: z.string().trim().min(1).max(128)
});
