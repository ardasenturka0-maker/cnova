import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { createPatient, getPatients } from "@/lib/services/patientService";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { patientSchema } from "@/lib/validations/patient";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/request-body";
import { rejectUntrustedMutation } from "@/lib/request-security";
import { publicErrorMessage } from "@/lib/public-error";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  if (query && query.length > 200) return NextResponse.json({ error: "Arama metni çok uzun." }, { status: 400 });
  const patients = await getPatients(session.organizationId, query || undefined);
  return NextResponse.json({ patients }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    const branchId = await getWritableBranchId(session);
    const payload = patientSchema.parse(await readJsonBody(request));
    const patient = await createPatient(session.organizationId, branchId, payload);
    return NextResponse.json({ patient }, { status: 201 });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return NextResponse.json({ error: publicErrorMessage(error, "Hasta kaydedilemedi.") }, { status: 400 });
  }
}
