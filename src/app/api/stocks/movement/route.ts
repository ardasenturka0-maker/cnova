import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { createStockMovement } from "@/lib/services/stockService";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { stockMovementSchema } from "@/lib/validations/stock";
import { canAccess } from "@/lib/rbac";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/request-body";
import { rejectUntrustedMutation } from "@/lib/request-security";
import { publicErrorMessage } from "@/lib/public-error";

export async function POST(request: Request) {
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    if (!canAccess(session.role, "stocks")) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
    const branchId = await getWritableBranchId(session);
    const payload = stockMovementSchema.parse(await readJsonBody(request));
    const movement = await createStockMovement(session.organizationId, branchId, payload);
    return NextResponse.json({ movement }, { status: 201 });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return NextResponse.json({ error: publicErrorMessage(error, "Stok hareketi kaydedilemedi.") }, { status: 400 });
  }
}
