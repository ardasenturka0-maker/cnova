import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo-mode";
import { paymentProvider } from "@/lib/integrations/paymentProvider";
import { canAccess } from "@/lib/rbac";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/request-body";
import { rejectUntrustedMutation } from "@/lib/request-security";

const payloadSchema = z.object({ amount: z.coerce.number().positive().max(100_000_000), description: z.string().trim().max(1000).optional(), patientId: z.string().trim().max(128).optional() });

export async function POST(request: Request) {
  if (!isDemoMode()) return NextResponse.json({ error: "Bu demo endpoint'i üretimde kapalıdır." }, { status: 404 });
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (!canAccess(session.role, "finance")) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  try {
    const payload = payloadSchema.parse(await readJsonBody(request));
    const result = await paymentProvider.charge({
      amount: payload.amount,
      currency: "TRY",
      description: payload.description ?? "ClinicNova mock tahsilat",
      patientId: payload.patientId
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return requestBodyErrorResponse(error) ?? NextResponse.json({ error: "İstek geçersiz." }, { status: 400 });
  }
}
