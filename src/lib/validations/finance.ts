import { z } from "zod";

export const paymentSchema = z.object({
  patientId: z.string().optional().or(z.literal("")),
  treatmentId: z.string().optional().or(z.literal("")),
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.coerce.number().positive("Tutar pozitif olmali."),
  listAmount: z.union([z.literal(""), z.coerce.number().min(0, "Liste fiyati negatif olamaz.")]).optional(),
  discountAmount: z.union([z.literal(""), z.coerce.number().min(0, "Indirim negatif olamaz.")]).optional(),
  isDeposit: z.preprocess((value) => value === "on" || value === "true", z.boolean()).default(false),
  referralSource: z.string().optional().or(z.literal("")),
  method: z.enum(["CASH", "CARD", "TRANSFER", "ONLINE"]),
  description: z.string().optional().or(z.literal("")),
  status: z.enum(["PAID", "PENDING", "CANCELLED"]),
  paidAt: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal(""))
});

export type PaymentInput = z.infer<typeof paymentSchema>;
