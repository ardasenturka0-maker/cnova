import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/services/auditLogService";
import { getMobileSnapshot, syncMobileOperations } from "@/lib/services/mobileSyncService";
import { mobileSyncBatchSchema } from "@/lib/validations/mobile-sync";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/request-body";
import { rejectUntrustedMutation } from "@/lib/request-security";
import { takeRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Sunucu oturumu gerekli." }, { status: 401 });
    const rateLimit = takeRateLimit({ key: `mobile-sync:${session.userId}`, limit: 240, windowMs: 60 * 60 * 1000 });
    if (!rateLimit.allowed) return NextResponse.json({ error: "Saatlik eşitleme sınırına ulaşıldı." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
    const batch = mobileSyncBatchSchema.parse(await readJsonBody(request, 1536 * 1024));
    const moduleForEntity = (entityType: (typeof batch.operations)[number]["entityType"]) => {
      if (entityType === "PATIENT") return "patients";
      if (entityType === "APPOINTMENT") return "appointments";
      if (entityType === "PAYMENT") return "finance";
      if (["TREATMENT_PLAN", "TREATMENT"].includes(entityType)) return "treatments";
      if (entityType.startsWith("STOCK_")) return "stocks";
      if (["DOCTOR", "STAFF"].includes(entityType)) return "staff";
      if (entityType === "CONSENT") return "consents";
      if (["SURVEY", "SURVEY_RESPONSE"].includes(entityType)) return "surveys";
      if (entityType === "COMMUNICATION") return "communication";
      if (entityType === "RECALL") return "recalls";
      return "settings";
    };
    const allowed = batch.operations.filter((item) => item.entityType !== "LEAD" && canAccess(session.role, moduleForEntity(item.entityType)));
    const denied = batch.operations.filter((item) => item.entityType === "LEAD" || !canAccess(session.role, moduleForEntity(item.entityType))).map((item) => ({ operationId: item.operationId, status: "failed" as const, error: item.entityType === "LEAD" ? "Sağlık turizmi modülü kaldırıldı." : "Bu modülü eşitleme yetkiniz yok." }));
    const results = [...await syncMobileOperations(session, { ...batch, operations: allowed }), ...denied];
    const synced = results.filter((item) => item.status === "synced").length;
    const snapshot = await getMobileSnapshot(session, batch.deviceId);
    await writeAuditLog({ userId: session.userId, action: "MOBILE_OFFLINE_SYNC", module: "mobile", organizationId: session.organizationId, branchId: session.branchId, metadata: { deviceId: batch.deviceId, received: batch.operations.length, synced } });
    return NextResponse.json({ results, synced, failed: results.length - synced, snapshot }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Senkronizasyon paketi geçersiz." }, { status: 400 });
    console.error("Mobile sync failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Senkronizasyon tamamlanamadı." }, { status: 500 });
  }
}
