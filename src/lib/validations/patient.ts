import { z } from "zod";
import { isReasonableBirthDate } from "@/lib/clinic-time";

export const patientSchema = z.object({
  firstName: z.string().trim().min(2, "Ad en az 2 karakter olmali.").max(100),
  lastName: z.string().trim().min(2, "Soyad en az 2 karakter olmali.").max(100),
  nationalId: z.string().trim().max(40).optional().or(z.literal("")),
  phone: z.string().trim().min(8, "Telefon gerekli.").max(40),
  email: z.string().trim().email("Gecerli e-posta girin.").max(240).optional().or(z.literal("")),
  birthDate: z.string().refine((value) => value === "" || isReasonableBirthDate(value), "Doğum tarihi 1900 ile bugün arasında olmalı.").optional().or(z.literal("")),
  gender: z.enum(["FEMALE", "MALE", "OTHER", "UNSPECIFIED"]).default("UNSPECIFIED"),
  address: z.string().trim().max(1000).optional().or(z.literal("")),
  allergies: z.string().trim().max(2000).optional().or(z.literal("")),
  chronicDiseases: z.string().trim().max(2000).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  tag: z.enum(["NEW", "ACTIVE", "PASSIVE", "RISKY", "VIP"]).default("NEW")
});

export type PatientInput = z.infer<typeof patientSchema>;
