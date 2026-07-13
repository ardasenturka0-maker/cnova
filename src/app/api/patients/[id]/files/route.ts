import { NextResponse } from "next/server";
import { PatientFileCategory } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteStoredPatientFile, preparePatientUpload, storePatientFile } from "@/lib/secure-file-storage";
import { writeAuditLog } from "@/lib/services/auditLogService";

function parseCategory(value: unknown): PatientFileCategory {
  const category = String(value ?? "");
  return (Object.values(PatientFileCategory) as string[]).includes(category)
    ? (category as PatientFileCategory)
    : PatientFileCategory.OTHER;
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireSession();
  const files = await prisma.patientFile.findMany({
    where: { patientId: params.id, organizationId: session.organizationId, deletedAt: null },
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
  });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requireSession();
    const patient = await prisma.patient.findFirst({ where: { id: params.id, organizationId: session.organizationId, deletedAt: null } });
    if (!patient) {
      return NextResponse.json({ error: "Hasta bulunamadı." }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Dosya seçilmedi." }, { status: 400 });
    }
    const prepared = await preparePatientUpload(Buffer.from(await file.arrayBuffer()));
    const note = String(formData.get("note") ?? "").trim();
    const storageKey = await storePatientFile(session.organizationId, patient.id, prepared);
    let created;
    try {
      created = await prisma.patientFile.create({
        data: {
          patientId: patient.id,
          organizationId: session.organizationId,
          category: parseCategory(formData.get("category")),
          fileName: file.name || `kamera-fotografi.${prepared.extension}`,
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dosya yüklenemedi." }, { status: 400 });
  }
}
