import { z } from "zod";
import { isReasonableBirthDate } from "@/lib/clinic-time";

const birthDateSchema = z.string().refine(isReasonableBirthDate, "Dogum tarihi 1900 ile bugün arasında olmalı.");

export const portalLoginSchema = z.object({
  organizationSlug: z.string().trim().max(100).toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Klinik kodu gecersiz."),
  phone: z.string().trim().min(7, "Telefon numarasi gecersiz.").max(40),
  birthDate: birthDateSchema
});

export const portalAppointmentSchema = z.object({
  doctorId: z.string().trim().min(1, "Doktor secin.").max(128),
  date: z.string().date("Gecerli bir tarih secin."),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Gecerli bir saat secin."),
  treatmentType: z.string().trim().min(1, "Islem secin.").max(200),
  notes: z.string().trim().max(4000).optional().or(z.literal(""))
});

export type PortalAppointmentInput = z.infer<typeof portalAppointmentSchema>;

const checkbox = z
  .union([z.literal("on"), z.literal("")])
  .optional()
  .transform((value) => value === "on");

export const portalHealthSchema = z.object({
  heartDisease: checkbox,
  asthma: checkbox,
  diabetes: checkbox,
  hypertension: checkbox,
  otherConditions: z.string().trim().max(2000).optional().or(z.literal("")),
  allergies: z.string().trim().max(2000).optional().or(z.literal("")),
  medications: z.string().trim().max(2000).optional().or(z.literal(""))
});

export const portalRegisterSchema = portalHealthSchema.extend({
  organizationSlug: z.string().trim().max(100).toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Klinik kodu gecersiz."),
  firstName: z.string().trim().min(2, "Ad gerekli.").max(80),
  lastName: z.string().trim().min(2, "Soyad gerekli.").max(80),
  phone: z.string().trim().min(7, "Telefon numarasi gecersiz.").max(40),
  email: z.string().trim().email("E-posta gecersiz.").max(240).toLowerCase().optional().or(z.literal("")),
  birthDate: birthDateSchema
});

export type PortalHealthInput = z.infer<typeof portalHealthSchema>;
export type PortalRegisterInput = z.infer<typeof portalRegisterSchema>;
