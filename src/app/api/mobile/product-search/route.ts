import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { takeRateLimit } from "@/lib/rate-limit";
import { inspectProductPage } from "@/lib/services/productSearchService";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/request-body";
import { rejectUntrustedMutation } from "@/lib/request-security";
import { publicErrorMessage } from "@/lib/public-error";
import { secureHttpsUrlSchema } from "@/lib/validations/common";

const requestSchema = z.object({ productUrl: secureHttpsUrlSchema });

export async function POST(request: Request) {
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Sunucu oturumu gerekli." }, { status: 401 });
    if (!canAccess(session.role, "stocks")) return NextResponse.json({ error: "Stok fiyatlarını arama yetkiniz yok." }, { status: 403 });
    const rateLimit = takeRateLimit({ key: `mobile-product-search:${session.userId}`, limit: 20, windowMs: 60 * 60 * 1000 });
    if (!rateLimit.allowed) return NextResponse.json({ error: "Saatlik ürün arama sınırına ulaşıldı." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
    const { productUrl } = requestSchema.parse(await readJsonBody(request, 8 * 1024));
    const offer = await inspectProductPage(productUrl);
    return NextResponse.json({ offers: [offer], checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Geçerli bir HTTPS satın alma sayfası girin." }, { status: 400 });
    return NextResponse.json({ error: publicErrorMessage(error, "Satın alma sayfasındaki fiyat alınamadı.") }, { status: 503 });
  }
}
