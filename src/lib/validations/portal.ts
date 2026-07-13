import { z } from "zod";

export const portalLoginSchema = z.object({
  organizationSlug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Klinik kodu gecersiz."),
  phone: z.string().min(7, "Telefon numarasi gecersiz."),
  birthDate: z.string().date("Dogum tarihi gecersiz.")
});

export const portalAppointmentSchema = z.object({
  doctorId: z.string().min(1, "Doktor secin."),
  date: z.string().min(1, "Tarih secin."),
  time: z.string().min(1, "Saat secin."),
  treatmentType: z.string().min(1, "Islem secin."),
  notes: z.string().optional().or(z.literal(""))
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
  otherConditions: z.string().optional().or(z.literal("")),
  allergies: z.string().optional().or(z.literal("")),
  medications: z.string().optional().or(z.literal(""))
});

export const portalRegisterSchema = portalHealthSchema.extend({
  organizationSlug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Klinik kodu gecersiz."),
  firstName: z.string().min(2, "Ad gerekli."),
  lastName: z.string().min(2, "Soyad gerekli."),
  phone: z.string().min(7, "Telefon numarasi gecersiz."),
  email: z.string().email("E-posta gecersiz.").optional().or(z.literal("")),
  birthDate: z.string().date("Dogum tarihi gecersiz.")
});

export type PortalHealthInput = z.infer<typeof portalHealthSchema>;
export type PortalRegisterInput = z.infer<typeof portalRegisterSchema>;
