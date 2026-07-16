import { z } from "zod";
import { prisma } from "@/lib/prisma";

const responseSchema = z.object({
  offers: z.array(z.object({
    seller: z.string().min(1),
    unitPrice: z.coerce.number().positive(),
    shippingPrice: z.coerce.number().min(0).default(0),
    productUrl: z.string().url().refine((url) => url.startsWith("https://")),
    inStock: z.boolean().default(true)
  })).max(50)
});

const secureProductUrlSchema = z.string().url().refine((value) => value.startsWith("https://"), "Yalnızca HTTPS ürün sayfası kullanılabilir.");

async function requestProductProvider(parameter: "q" | "url", value: string) {
  const configuredEndpoint = process.env.PRODUCT_SEARCH_API_URL;
  const apiKey = process.env.PRODUCT_SEARCH_API_KEY;
  let endpoint = configuredEndpoint;
  if (configuredEndpoint?.startsWith("/")) {
    try { endpoint = new URL(configuredEndpoint, process.env.NEXT_PUBLIC_APP_URL).toString(); }
    catch { endpoint = undefined; }
  }
  const localDevelopmentEndpoint = process.env.NODE_ENV !== "production" && endpoint?.startsWith("http://localhost:");
  if (!endpoint || !apiKey || (!endpoint.startsWith("https://") && !localDevelopmentEndpoint)) throw new Error("Canlı ürün fiyat sağlayıcısı yapılandırılmamış.");

  const url = new URL(endpoint);
  url.searchParams.set(parameter, value);
  const response = await fetch(url, { headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : "";
    throw new Error(detail || "Ürün fiyatı satın alma sayfasından alınamadı.");
  }
  return responseSchema.parse(body).offers
    .filter((offer) => offer.inStock)
    .sort((left, right) => left.unitPrice + left.shippingPrice - right.unitPrice - right.shippingPrice);
}

export async function searchProductOffers(query: string) {
  const normalizedQuery = query.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (normalizedQuery.length < 2 || normalizedQuery.length > 200) throw new Error("Ürün arama metni geçersiz.");
  return requestProductProvider("q", normalizedQuery);
}

export async function inspectProductPage(productUrl: string) {
  const normalizedUrl = secureProductUrlSchema.parse(productUrl.trim());
  const offers = await requestProductProvider("url", normalizedUrl);
  const offer = offers[0];
  if (!offer) throw new Error("Bu satın alma sayfasında satışta bir fiyat bulunamadı.");
  return { ...offer, productUrl: normalizedUrl };
}

export async function refreshProductOffers(organizationId: string, itemId: string, productUrl: string) {
  const item = await prisma.stockItem.findFirst({ where: { id: itemId, organizationId }, select: { id: true, name: true, branchId: true } });
  if (!item) throw new Error("Stok kalemi bulunamadı.");
  const offer = await inspectProductPage(productUrl);
  const checkedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.stockOffer.deleteMany({ where: { itemId: item.id, organizationId, productUrl: offer.productUrl } });
    await tx.stockOffer.create({ data: { ...offer, checkedAt, itemId: item.id, organizationId, branchId: item.branchId } });
  });
  return offer;
}
