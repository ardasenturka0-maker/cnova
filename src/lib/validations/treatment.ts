import { z } from "zod";

const treatmentBaseSchema = z.object({
  patientId: z.string().trim().min(1, "Lütfen bir hasta seçin."),
  doctorId: z.string().trim().min(1, "Lütfen bir doktor seçin."),
  toothNumber: z.string().trim().optional().or(z.literal("")),
  treatmentType: z.string().trim().min(2, "Tedavi türü en az 2 karakter olmalı."),
  description: z.string().trim().optional().or(z.literal("")),
  fee: z.coerce.number({ invalid_type_error: "Ücret sayısal olmalı." }).min(0, "Ücret negatif olamaz."),
  downPayment: z.coerce.number({ invalid_type_error: "Peşinat sayısal olmalı." }).min(0, "Peşinat negatif olamaz.").default(0),
  installmentCount: z.coerce.number({ invalid_type_error: "Taksit sayısı sayısal olmalı." }).int("Taksit sayısı tam sayı olmalı.").min(1, "En az 1 taksit seçin.").max(24, "En fazla 24 taksit seçilebilir.").default(1),
  firstInstallmentDate: z.string().optional().or(z.literal("")).refine((value) => !value || !Number.isNaN(new Date(value).getTime()), "Geçerli bir ilk ödeme tarihi seçin."),
  paymentPlanNote: z.string().trim().max(500, "Tahsilat notu 500 karakteri geçemez.").optional().or(z.literal("")),
  status: z.enum(["PROPOSED", "ACCEPTED", "STARTED", "COMPLETED", "CANCELLED"]),
  date: z.string().optional().or(z.literal("")).refine((value) => !value || !Number.isNaN(new Date(value).getTime()), "Geçerli bir tarih seçin.")
});

export const treatmentSchema = treatmentBaseSchema.refine((value) => value.downPayment <= value.fee, {
  message: "Peşinat toplam ücretten büyük olamaz.",
  path: ["downPayment"]
});

export const treatmentPlanSchema = treatmentBaseSchema.extend({
  estimatedFee: z.coerce.number({ invalid_type_error: "Tahmini ücret sayısal olmalı." }).min(0, "Tahmini ücret negatif olamaz.")
}).omit({ fee: true }).refine((value) => value.downPayment <= value.estimatedFee, {
  message: "Peşinat tahmini ücretten büyük olamaz.",
  path: ["downPayment"]
});
