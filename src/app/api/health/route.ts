import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.organization.findFirst({ select: { id: true } });
    return NextResponse.json(
      {
        status: "ok",
        service: "clinicnova",
        version: "1.2.1",
        timestamp: new Date().toISOString()
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      {
        status: "unavailable",
        service: "clinicnova",
        timestamp: new Date().toISOString()
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
