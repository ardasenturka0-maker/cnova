import { z } from "zod";
import { parseClinicDateTime } from "@/lib/clinic-time";

export const appointmentSchema = z.object({
  patientId: z.string().trim().min(1, "Hasta secin.").max(128),
  doctorId: z.string().trim().min(1, "Doktor secin.").max(128),
  startsAt: z.string().trim().min(1, "Tarih ve saat secin.").refine((value) => parseClinicDateTime(value) !== null, "Gecerli bir tarih ve saat secin."),
  durationMinutes: z.coerce.number().int().min(15).max(240),
  room: z.string().trim().max(80).optional().or(z.literal("")),
  treatmentType: z.string().trim().min(2, "Islem turu gerekli.").max(200),
  status: z.enum(["PENDING_CONFIRMATION", "PLANNED", "ARRIVED", "NO_SHOW", "CANCELLED", "COMPLETED"]).default("PLANNED"),
  notes: z.string().trim().max(4000).optional().or(z.literal(""))
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;
