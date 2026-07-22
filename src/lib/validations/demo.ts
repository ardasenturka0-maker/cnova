import { z } from "zod";

export const demoRequestSchema = z.object({
  fullName: z.string().trim().min(2, "Ad soyad gerekli.").max(160),
  clinicName: z.string().trim().min(2, "Klinik adi gerekli.").max(160),
  phone: z.string().trim().min(8, "Telefon gerekli.").max(40),
  email: z.string().trim().email("Gecerli bir e-posta girin.").max(240),
  city: z.string().trim().min(2, "Sehir gerekli.").max(120),
  clinicSize: z.string().trim().min(1, "Klinik buyuklugu secin.").max(80),
  message: z.string().max(1000).optional().or(z.literal(""))
});
