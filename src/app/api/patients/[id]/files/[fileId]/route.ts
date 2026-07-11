import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string; fileId: string }> }
) {
  const params = await props.params;
  const session = await requireSession();
  const file = await prisma.patientFile.findFirst({
    where: { id: params.fileId, patientId: params.id, organizationId: session.organizationId }
  });
  if (!file) {
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
  }

  const bytes = file.data instanceof Uint8Array ? file.data : Buffer.from(file.data);
  const body = new Blob([new Uint8Array(bytes)], { type: file.mimeType });
  return new NextResponse(body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
      "Cache-Control": "private, max-age=300"
    }
  });
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string; fileId: string }> }
) {
  const params = await props.params;
  const session = await requireSession();
  await prisma.patientFile.deleteMany({
    where: { id: params.fileId, patientId: params.id, organizationId: session.organizationId }
  });
  return NextResponse.json({ ok: true });
}
