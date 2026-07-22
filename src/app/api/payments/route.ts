import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { createPayment, getFinanceOverview } from "@/lib/services/financeService";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { paymentSchema } from "@/lib/validations/finance";
import { canAccess } from "@/lib/rbac";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/request-body";
import { rejectUntrustedMutation } from "@/lib/request-security";
import { publicErrorMessage } from "@/lib/public-error";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!canAccess(session.role, "finance")) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  const finance = await getFinanceOverview(session.organizationId);
  return NextResponse.json(finance, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    if (!canAccess(session.role, "finance")) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
    const branchId = await getWritableBranchId(session);
    const payload = paymentSchema.parse(await readJsonBody(request));
    const payment = await createPayment(session.organizationId, branchId, payload);
    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return NextResponse.json({ error: publicErrorMessage(error, "Odeme kaydedilemedi.") }, { status: 400 });
  }
}
