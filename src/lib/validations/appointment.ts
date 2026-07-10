import { z } from "zod";

export const appointmentSchema = z.object({
  patientId: z.string().min(1, "Hasta secin."),
  doctorId: z.string().min(1, "Doktor secin."),
  startsAt: z.string().min(1, "Tarih ve saat secin.").refine((value) => !Number.isNaN(new Date(value).getTime()), "Gecerli bir tarih ve saat secin."),
  durationMinutes: z.coerce.number().int().min(15).max(240),
  room: z.string().optional().or(z.literal("")),
  treatmentType: z.string().min(2, "Islem turu gerekli."),
  status: z.enum(["PLANNED", "ARRIVED", "NO_SHOW", "CANCELLED", "COMPLETED"]).default("PLANNED"),
  notes: z.string().optional().or(z.literal(""))
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;
