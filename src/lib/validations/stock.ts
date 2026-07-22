import { z } from "zod";
import { secureHttpsUrlSchema } from "@/lib/validations/common";

export const stockItemSchema = z.object({
  name: z.string().trim().min(2, "Urun adi gerekli.").max(200),
  category: z.string().trim().min(2, "Kategori gerekli.").max(120),
  currentQuantity: z.coerce.number().int().min(0).max(100_000_000),
  minimumQuantity: z.coerce.number().int().min(0).max(100_000_000),
  unit: z.string().trim().min(1, "Birim gerekli.").max(40),
  supplier: z.string().trim().max(200).optional().or(z.literal("")),
  purchasePrice: z.coerce.number().min(0).max(100_000_000)
});

export const stockMovementSchema = z.object({
  itemId: z.string().trim().min(1).max(128),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().int().min(0).max(100_000_000),
  note: z.string().trim().max(500).optional().or(z.literal(""))
}).refine((value) => value.type === "ADJUSTMENT" || value.quantity > 0, {
  message: "Giriş ve çıkış miktarı sıfırdan büyük olmalı.",
  path: ["quantity"]
});

export const stockOfferSchema = z.object({
  itemId: z.string().trim().min(1, "Ürün gerekli.").max(128),
  seller: z.string().trim().min(2, "Satıcı gerekli.").max(200),
  unitPrice: z.coerce.number().positive("Fiyat pozitif olmalı.").max(100_000_000),
  shippingPrice: z.coerce.number().min(0).max(100_000_000).default(0),
  productUrl: secureHttpsUrlSchema,
  inStock: z.preprocess((value) => value === "on" || value === "true", z.boolean()).default(false)
});

export const stockRecipeSchema = z.object({
  treatmentType: z.string().trim().min(2, "Tedavi adı en az 2 karakter olmalı.").max(200),
  itemId: z.string().trim().min(1, "Bir stok ürünü seçin.").max(128),
  quantity: z.coerce.number().int("Miktar tam sayı olmalı.").min(1, "Miktar en az 1 olmalı.").max(100_000)
});
