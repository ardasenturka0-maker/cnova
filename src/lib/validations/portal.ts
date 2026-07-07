import { z } from "zod";

export const portalLoginSchema = z.object({
  phone: z.string().min(7, "Telefon numarasi gecersiz.")
});

export const portalAppointmentSchema = z.object({
  doctorId: z.string().min(1, "Doktor secin."),
  date: z.string().min(1, "Tarih secin."),
  time: z.string().min(1, "Saat secin."),
  treatmentType: z.string().min(1, "Islem secin."),
  notes: z.string().optional().or(z.literal(""))
});

export type PortalAppointmentInput = z.infer<typeof portalAppointmentSchema>;
