import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { inspectPublicProductPage } from "@/lib/services/productPageInspectorService";
import { publicErrorMessage } from "@/lib/public-error";
import { secureHttpsUrlSchema } from "@/lib/validations/common";

const requestSchema = z.object({ url: secureHttpsUrlSchema });

function authorized(request: Request) {
  const expected = process.env.PRODUCT_SEARCH_API_KEY || "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Geçersiz ürün fiyatı API anahtarı." }, { status: 401 });
  try {
    const { url } = requestSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const offer = await inspectPublicProductPage(url);
    return NextResponse.json({ offers: [offer] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Geçerli bir HTTPS ürün sayfası girin." }, { status: 400 });
    return NextResponse.json({ error: publicErrorMessage(error, "Ürün sayfası okunamadı.") }, { status: 422 });
  }
}
