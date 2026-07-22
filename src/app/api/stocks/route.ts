import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { createStockItem, getStocks } from "@/lib/services/stockService";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { stockItemSchema } from "@/lib/validations/stock";
import { canAccess } from "@/lib/rbac";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/request-body";
import { rejectUntrustedMutation } from "@/lib/request-security";
import { publicErrorMessage } from "@/lib/public-error";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!canAccess(session.role, "stocks")) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  const stocks = await getStocks(session.organizationId);
  return NextResponse.json({ stocks }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    if (!canAccess(session.role, "stocks")) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
    const branchId = await getWritableBranchId(session);
    const payload = stockItemSchema.parse(await readJsonBody(request));
    const stock = await createStockItem(session.organizationId, branchId, payload);
    return NextResponse.json({ stock }, { status: 201 });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return NextResponse.json({ error: publicErrorMessage(error, "Stok kaydedilemedi.") }, { status: 400 });
  }
}
