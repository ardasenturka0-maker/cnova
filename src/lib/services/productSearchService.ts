import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { secureHttpsUrlSchema } from "@/lib/validations/common";

const maximumProviderResponseBytes = 512 * 1024;

const responseSchema = z.object({
  offers: z.array(z.object({
    seller: z.string().trim().min(1).max(200),
    unitPrice: z.coerce.number().positive().max(100_000_000),
    shippingPrice: z.coerce.number().min(0).max(100_000_000).default(0),
    productUrl: secureHttpsUrlSchema,
    inStock: z.boolean().default(true)
  })).max(50)
});

async function readProviderJson(response: Response) {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumProviderResponseBytes)) {
    throw new Error("Ürün fiyatı sağlayıcısının yanıtı çok büyük.");
  }
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType && contentType !== "application/json" && !contentType.endsWith("+json")) {
    throw new Error("Ürün fiyatı sağlayıcısı geçerli JSON döndürmedi.");
  }
  if (!response.body) throw new Error("Ürün fiyatı sağlayıcısı boş yanıt döndürdü.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumProviderResponseBytes) {
        await reader.cancel();
        throw new Error("Ürün fiyatı sağlayıcısının yanıtı çok büyük.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new Error("Ürün fiyatı sağlayıcısı geçerli JSON döndürmedi.");
  }
}

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
  if (!response.ok) {
    throw new Error("Ürün fiyatı satın alma sayfasından alınamadı.");
  }
  const body = await readProviderJson(response);
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
  const normalizedUrl = secureHttpsUrlSchema.parse(productUrl);
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
