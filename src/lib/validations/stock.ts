import { z } from "zod";

export const stockItemSchema = z.object({
  name: z.string().min(2, "Urun adi gerekli."),
  category: z.string().min(2, "Kategori gerekli."),
  currentQuantity: z.coerce.number().int().min(0),
  minimumQuantity: z.coerce.number().int().min(0),
  unit: z.string().min(1, "Birim gerekli."),
  supplier: z.string().optional().or(z.literal("")),
  purchasePrice: z.coerce.number().min(0)
});

export const stockMovementSchema = z.object({
  itemId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().int().min(0),
  note: z.string().optional().or(z.literal(""))
}).refine((value) => value.type === "ADJUSTMENT" || value.quantity > 0, {
  message: "Giriş ve çıkış miktarı sıfırdan büyük olmalı.",
  path: ["quantity"]
});

export const stockOfferSchema = z.object({
  itemId: z.string().min(1, "Ürün gerekli."),
  seller: z.string().min(2, "Satıcı gerekli."),
  unitPrice: z.coerce.number().positive("Fiyat pozitif olmalı."),
  shippingPrice: z.coerce.number().min(0).default(0),
  productUrl: z.string().url("Geçerli bir HTTPS ürün adresi girin.").refine((url) => url.startsWith("https://"), "Yalnızca HTTPS adresi kullanılabilir."),
  inStock: z.preprocess((value) => value === "on" || value === "true", z.boolean()).default(false)
});

export const stockRecipeSchema = z.object({
  treatmentType: z.string().trim().min(2, "Tedavi adı en az 2 karakter olmalı.").max(200),
  itemId: z.string().trim().min(1, "Bir stok ürünü seçin."),
  quantity: z.coerce.number().int("Miktar tam sayı olmalı.").min(1, "Miktar en az 1 olmalı.").max(100_000)
});
