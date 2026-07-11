import { NextResponse } from "next/server";
import { PatientFileCategory } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

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
    where: { patientId: params.id, organizationId: session.organizationId },
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
    const patient = await prisma.patient.findFirst({ where: { id: params.id, organizationId: session.organizationId } });
    if (!patient) {
      return NextResponse.json({ error: "Hasta bulunamadı." }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Dosya seçilmedi." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Dosya 15 MB sınırını aşıyor." }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Sadece fotoğraf (JPG, PNG, WebP, HEIC) ve PDF yüklenebilir." }, { status: 400 });
    }

    const data = Buffer.from(await file.arrayBuffer());
    const note = String(formData.get("note") ?? "").trim();
    const created = await prisma.patientFile.create({
      data: {
        patientId: patient.id,
        organizationId: session.organizationId,
        category: parseCategory(formData.get("category")),
        fileName: file.name || "kamera-fotografi.jpg",
        mimeType: file.type,
        size: file.size,
        data,
        note: note.length > 0 ? note : null
      }
    });

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
