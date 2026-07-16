import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/services/auditLogService";
import { getMobileSnapshot, syncMobileOperations } from "@/lib/services/mobileSyncService";
import { mobileSyncBatchSchema } from "@/lib/validations/mobile-sync";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Sunucu oturumu gerekli." }, { status: 401 });
    const batch = mobileSyncBatchSchema.parse(await request.json());
    if (batch.operations.some((item) => item.entityType === "PATIENT") && !canAccess(session.role, "patients")) return NextResponse.json({ error: "Hasta eşitleme yetkiniz yok." }, { status: 403 });
    if (batch.operations.some((item) => item.entityType === "APPOINTMENT") && !canAccess(session.role, "appointments")) return NextResponse.json({ error: "Randevu eşitleme yetkiniz yok." }, { status: 403 });
    if (batch.operations.some((item) => item.entityType === "PAYMENT") && !canAccess(session.role, "finance")) return NextResponse.json({ error: "Finans eşitleme yetkiniz yok." }, { status: 403 });
    if (batch.operations.some((item) => item.entityType === "TREATMENT_PLAN") && !canAccess(session.role, "treatments")) return NextResponse.json({ error: "Tedavi planı eşitleme yetkiniz yok." }, { status: 403 });
    if (batch.operations.some((item) => item.entityType.startsWith("STOCK_")) && !canAccess(session.role, "stocks")) return NextResponse.json({ error: "Stok eşitleme yetkiniz yok." }, { status: 403 });
    if (batch.operations.some((item) => item.entityType === "DOCTOR") && !canAccess(session.role, "staff")) return NextResponse.json({ error: "Doktor yönetimi yetkiniz yok." }, { status: 403 });
    if (batch.operations.some((item) => item.entityType === "CLINIC_CONFIG") && !canAccess(session.role, "settings")) return NextResponse.json({ error: "Klinik ayarları yetkiniz yok." }, { status: 403 });
    const results = await syncMobileOperations(session, batch);
    const synced = results.filter((item) => item.status === "synced").length;
    const snapshot = await getMobileSnapshot(session, batch.deviceId);
    await writeAuditLog({ userId: session.userId, action: "MOBILE_OFFLINE_SYNC", module: "mobile", organizationId: session.organizationId, branchId: session.branchId, metadata: { deviceId: batch.deviceId, received: batch.operations.length, synced } });
    return NextResponse.json({ results, synced, failed: results.length - synced, snapshot });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Senkronizasyon paketi geçersiz." }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Senkronizasyon tamamlanamadı." }, { status: 500 });
  }
}
