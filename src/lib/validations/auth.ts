import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Gecerli bir e-posta girin.").max(240).toLowerCase(),
  password: z.string().min(8, "Sifre en az 8 karakter olmali.").max(128),
  mfaCode: z.string().trim().min(6).max(20).optional()
});

export const registerSchema = z.object({
  clinicName: z.string().trim().min(2, "Klinik adi gerekli.").max(160),
  fullName: z.string().trim().min(2, "Ad soyad gerekli.").max(160),
  email: z.string().trim().email("Gecerli bir e-posta girin.").max(240).toLowerCase(),
  password: z.string()
    .min(12, "Şifre en az 12 karakter olmalı.")
    .max(128, "Şifre 128 karakteri geçemez.")
    .regex(/[a-z]/, "Şifre küçük harf içermeli.")
    .regex(/[A-Z]/, "Şifre büyük harf içermeli.")
    .regex(/[0-9]/, "Şifre rakam içermeli.")
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta girin.").max(240).toLowerCase()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(40, "Şifre yenileme bağlantısı geçersiz.").max(128),
  password: z.string()
    .min(12, "Şifre en az 12 karakter olmalı.")
    .max(128, "Şifre 128 karakteri geçemez.")
    .regex(/[a-z]/, "Şifre küçük harf içermeli.")
    .regex(/[A-Z]/, "Şifre büyük harf içermeli.")
    .regex(/[0-9]/, "Şifre rakam içermeli.")
});
