import { z } from "zod";
import { parseClinicDateKey } from "@/lib/clinic-time";

const optionalDate = z.string().refine((value) => value === "" || parseClinicDateKey(value) !== null, "Geçerli bir tarih girin.").optional().or(z.literal(""));

export const paymentSchema = z.object({
  patientId: z.string().trim().max(128).optional().or(z.literal("")),
  treatmentId: z.string().trim().max(128).optional().or(z.literal("")),
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.coerce.number().positive("Tutar pozitif olmali.").max(100_000_000),
  listAmount: z.union([z.literal(""), z.coerce.number().min(0, "Liste fiyati negatif olamaz.").max(100_000_000)]).optional(),
  discountAmount: z.union([z.literal(""), z.coerce.number().min(0, "Indirim negatif olamaz.").max(100_000_000)]).optional(),
  isDeposit: z.preprocess((value) => value === "on" || value === "true", z.boolean()).default(false),
  referralSource: z.string().trim().max(200).optional().or(z.literal("")),
  method: z.enum(["CASH", "CARD", "TRANSFER", "ONLINE"]),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  status: z.enum(["PAID", "PENDING", "CANCELLED"]),
  paidAt: optionalDate,
  dueDate: optionalDate
});

export type PaymentInput = z.infer<typeof paymentSchema>;
