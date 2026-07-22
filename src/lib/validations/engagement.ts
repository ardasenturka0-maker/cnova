import { z } from "zod";
import { parseClinicDateKey } from "@/lib/clinic-time";

export const consentSchema = z.object({
  patientId: z.string().trim().min(1, "Lütfen bir hasta seçin.").max(128),
  templateName: z.string().trim().min(2, "Onam şablonu en az 2 karakter olmalı.").max(200),
  content: z.string().trim().min(10, "Onam içeriği en az 10 karakter olmalı.").max(20_000),
  status: z.enum(["DRAFT", "SENT", "SIGNED", "CANCELLED"]).default("DRAFT")
});

export const surveySchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal(""))
});

export const communicationSchema = z.object({
  patientId: z.string().trim().max(128).optional().or(z.literal("")),
  to: z.string().trim().min(3, "Alıcı bilgisi en az 3 karakter olmalı.").max(240),
  channel: z.enum(["WHATSAPP", "SMS", "EMAIL"]),
  subject: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().min(3, "Mesaj en az 3 karakter olmalı.").max(10_000)
});

export const incomingCommunicationSchema = z.object({
  patientId: z.string().trim().max(128).optional().or(z.literal("")),
  contactName: z.string().trim().max(120).optional().or(z.literal("")),
  contactValue: z.string().trim().min(3, "Gönderen bilgisi en az 3 karakter olmalı.").max(240),
  channel: z.enum(["WHATSAPP", "SMS", "EMAIL", "PHONE"]),
  source: z.string().trim().max(120).optional().or(z.literal("")),
  subject: z.string().trim().min(2, "Konu en az 2 karakter olmalı.").max(120),
  message: z.string().trim().min(3, "Mesaj en az 3 karakter olmalı.").max(10_000)
});

export const recallSchema = z.object({
  patientId: z.string().trim().min(1).max(128),
  reason: z.string().trim().min(2).max(500),
  dueDate: z.string().refine((value) => parseClinicDateKey(value) !== null, "Geçerli bir recall tarihi seçin."),
  status: z.enum(["OPEN", "CONTACTED", "SCHEDULED", "CLOSED"]).default("OPEN"),
  notes: z.string().trim().max(2000).optional().or(z.literal(""))
});
