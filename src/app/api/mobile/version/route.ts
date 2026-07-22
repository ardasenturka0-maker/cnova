import { NextResponse } from "next/server";
import { getMobileRelease } from "@/lib/mobile-release";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(getMobileRelease(), { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } });
  } catch {
    return NextResponse.json({ error: "Mobil güncelleme yapılandırması hazır değil." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
