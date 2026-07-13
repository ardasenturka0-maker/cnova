import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { prisma } from "@/lib/prisma";
import { getProductionReadiness } from "@/lib/production-readiness";
import { assertFileSecurityReady } from "@/lib/secure-file-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const readiness = getProductionReadiness();
  let databaseReady = isDemoMode();
  let fileSecurityReady = isDemoMode();

  if (!databaseReady) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseReady = true;
    } catch {
      databaseReady = false;
    }
  }
  if (!fileSecurityReady) {
    try {
      await assertFileSecurityReady();
      fileSecurityReady = true;
    } catch {
      fileSecurityReady = false;
    }
  }

  const ready = readiness.ready && databaseReady && fileSecurityReady;
  return NextResponse.json(
    {
      status: ready ? "ready" : "not_ready",
      mode: readiness.mode,
      database: databaseReady ? "ok" : "unavailable",
      fileSecurity: fileSecurityReady ? "ok" : "unavailable",
      checks: readiness.checks.map(({ key, label, state, detail }) => ({ key, label, state, detail })),
      timestamp: new Date().toISOString()
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
