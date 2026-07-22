import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { createAppointment, getAppointments } from "@/lib/services/appointmentService";
import { appointmentSchema } from "@/lib/validations/appointment";
import { canAccess } from "@/lib/rbac";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/request-body";
import { rejectUntrustedMutation } from "@/lib/request-security";
import { publicErrorMessage } from "@/lib/public-error";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!canAccess(session.role, "appointments")) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  const appointments = await getAppointments(session.organizationId);
  return NextResponse.json({ appointments }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    if (!canAccess(session.role, "appointments")) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
    const payload = appointmentSchema.parse(await readJsonBody(request));
    const appointment = await createAppointment(session.organizationId, payload);
    return NextResponse.json({ appointment }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return NextResponse.json({ error: publicErrorMessage(error, "Randevu kaydedilemedi.") }, { status: 400 });
  }
}
