import { NextResponse } from "next/server";
import { PatientFileCategory } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteStoredPatientFile, preparePatientUpload, storePatientFile } from "@/lib/secure-file-storage";
import { writeAuditLog } from "@/lib/services/auditLogService";
import { readFormDataBody, requestBodyErrorResponse } from "@/lib/request-body";
import { rejectUntrustedMutation } from "@/lib/request-security";
import { takeRateLimit } from "@/lib/rate-limit";
import { publicErrorMessage } from "@/lib/public-error";

function parseCategory(value: unknown): PatientFileCategory {
  const category = String(value ?? "");
  return (Object.values(PatientFileCategory) as string[]).includes(category)
    ? (category as PatientFileCategory)
    : PatientFileCategory.OTHER;
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (params.id.length > 128) return NextResponse.json({ error: "Hasta bulunamadı." }, { status: 404 });
  const files = await prisma.patientFile.findMany({
    where: { patientId: params.id, organizationId: session.organizationId, deletedAt: null, patient: { deletedAt: null } },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({
    files: files.map((file) => ({
      id: file.id,
      category: file.category,
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.size,
      note: file.note,
      createdAt: file.createdAt
    }))
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    if (params.id.length > 128) return NextResponse.json({ error: "Hasta bulunamadı." }, { status: 404 });
    const rateLimit = takeRateLimit({ key: `patient-file-upload:${session.userId}`, limit: 30, windowMs: 60 * 60 * 1000 });
    if (!rateLimit.allowed) return NextResponse.json({ error: "Saatlik dosya yükleme sınırına ulaşıldı." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
    const patient = await prisma.patient.findFirst({ where: { id: params.id, organizationId: session.organizationId, deletedAt: null } });
    if (!patient) {
      return NextResponse.json({ error: "Hasta bulunamadı." }, { status: 404 });
    }

    const formData = await readFormDataBody(request, 16 * 1024 * 1024);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Dosya seçilmedi." }, { status: 400 });
    }
    const prepared = await preparePatientUpload(Buffer.from(await file.arrayBuffer()));
    const note = String(formData.get("note") ?? "").trim();
    if (note.length > 2000) return NextResponse.json({ error: "Dosya notu 2000 karakteri geçemez." }, { status: 400 });
    const storageKey = await storePatientFile(session.organizationId, patient.id, prepared);
    let created;
    try {
      created = await prisma.patientFile.create({
        data: {
          patientId: patient.id,
          organizationId: session.organizationId,
          category: parseCategory(formData.get("category")),
          fileName: file.name.trim().slice(0, 240) || `kamera-fotografi.${prepared.extension}`,
          mimeType: prepared.mimeType,
          storedMimeType: prepared.mimeType,
          size: prepared.bytes.length,
          data: null,
          storageKey,
          checksumSha256: prepared.checksumSha256,
          note: note.length > 0 ? note : null
        }
      });
    } catch (error) {
      await deleteStoredPatientFile(storageKey);
      throw error;
    }
    await writeAuditLog({ userId: session.userId, action: "UPLOAD_PATIENT_FILE", module: "patients", entityId: created.id, metadata: { patientId: patient.id, mimeType: prepared.mimeType, size: prepared.bytes.length }, organizationId: session.organizationId, branchId: session.branchId });

    return NextResponse.json({
      file: {
        id: created.id,
        category: created.category,
        fileName: created.fileName,
        mimeType: created.mimeType,
        size: created.size,
        note: created.note,
        createdAt: created.createdAt
      }
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return NextResponse.json({ error: publicErrorMessage(error, "Dosya yüklenemedi.") }, { status: 400 });
  }
}
