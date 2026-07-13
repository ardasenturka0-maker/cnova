import { NextResponse } from "next/server";
import { canManageTrash, requireSession } from "@/lib/auth";
import { deletePatient, getPatientById, updatePatient } from "@/lib/services/patientService";
import { patientSchema } from "@/lib/validations/patient";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireSession();
  const patient = await getPatientById(session.organizationId, params.id);
  if (!patient) {
    return NextResponse.json({ error: "Hasta bulunamadi." }, { status: 404 });
  }
  return NextResponse.json({ patient });
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requireSession();
    const payload = patientSchema.parse(await request.json());
    await updatePatient(session.organizationId, params.id, payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Hasta guncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireSession();
  if (!canManageTrash(session.role)) return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  await deletePatient(session.organizationId, params.id, session.userId, session.branchId);
  return NextResponse.json({ ok: true });
}
