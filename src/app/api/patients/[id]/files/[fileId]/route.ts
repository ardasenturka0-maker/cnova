import { NextResponse } from "next/server";
import { canDeletePatientFile, getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readPatientFile } from "@/lib/secure-file-storage";
import { writeAuditLog } from "@/lib/services/auditLogService";
import { rejectUntrustedMutation } from "@/lib/request-security";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string; fileId: string }> }
) {
  const params = await props.params;
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (params.id.length > 128 || params.fileId.length > 128) return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
  const file = await prisma.patientFile.findFirst({
    where: { id: params.fileId, patientId: params.id, organizationId: session.organizationId, deletedAt: null, patient: { deletedAt: null } }
  });
  if (!file) {
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
  }

  const bytes = file.storageKey
    ? await readPatientFile(file.storageKey, file.checksumSha256)
    : file.data instanceof Uint8Array
      ? Buffer.from(file.data)
      : file.data
        ? Buffer.from(file.data)
        : null;
  if (!bytes) return NextResponse.json({ error: "Dosya gövdesi bulunamadı." }, { status: 410 });
  const body = new Blob([new Uint8Array(bytes)], { type: file.mimeType });
  return new NextResponse(body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string; fileId: string }> }
) {
  const params = await props.params;
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (params.id.length > 128 || params.fileId.length > 128) return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
  if (!canDeletePatientFile(session.role)) return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  const now = new Date();
  const result = await prisma.patientFile.updateMany({
    where: { id: params.fileId, patientId: params.id, organizationId: session.organizationId, deletedAt: null, patient: { deletedAt: null } },
    data: { deletedAt: now, purgeAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), deletedById: session.userId, restoredAt: null, restoredById: null }
  });
  if (result.count !== 1) return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
  if (result.count > 0) await writeAuditLog({ userId: session.userId, action: "SOFT_DELETE_PATIENT_FILE", module: "patients", entityId: params.fileId, metadata: { patientId: params.id, purgeAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() }, organizationId: session.organizationId, branchId: session.branchId });
  return NextResponse.json({ ok: true, retainedDays: 30 });
}
