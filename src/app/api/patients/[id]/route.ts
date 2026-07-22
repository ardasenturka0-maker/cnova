import { NextResponse } from "next/server";
import { canManageTrash, getCurrentSession } from "@/lib/auth";
import { deletePatient, getPatientById, updatePatient } from "@/lib/services/patientService";
import { patientSchema } from "@/lib/validations/patient";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/request-body";
import { rejectUntrustedMutation } from "@/lib/request-security";
import { publicErrorMessage } from "@/lib/public-error";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (params.id.length > 128) return NextResponse.json({ error: "Hasta bulunamadi." }, { status: 404 });
  const patient = await getPatientById(session.organizationId, params.id);
  if (!patient) {
    return NextResponse.json({ error: "Hasta bulunamadi." }, { status: 404 });
  }
  return NextResponse.json({ patient }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    if (params.id.length > 128) return NextResponse.json({ error: "Hasta bulunamadı." }, { status: 404 });
    const payload = patientSchema.parse(await readJsonBody(request));
    const result = await updatePatient(session.organizationId, params.id, payload);
    if (result.count !== 1) return NextResponse.json({ error: "Hasta bulunamadı." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return NextResponse.json({ error: publicErrorMessage(error, "Hasta guncellenemedi.") }, { status: 400 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (params.id.length > 128) return NextResponse.json({ error: "Hasta bulunamadı." }, { status: 404 });
  if (!canManageTrash(session.role)) return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  const result = await deletePatient(session.organizationId, params.id, session.userId, session.branchId);
  if (result.count !== 1) return NextResponse.json({ error: "Hasta bulunamadı." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
