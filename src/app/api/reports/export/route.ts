import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getReports } from "@/lib/services/reportService";
import { canAccess } from "@/lib/rbac";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!canAccess(session.role, "reports")) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  const reports = await getReports(session.organizationId);
  const rows = [
    ["metric", "value"],
    ["revenue", reports.revenue],
    ["expense", reports.expense],
    ["net_revenue", reports.netRevenue],
    ["pending_revenue", reports.pendingRevenue],
    ["stock_value", reports.stockValue],
    ["no_show_rate", reports.noShowRate],
    ["cancellation_rate", reports.cancellationRate],
    ["treatment_count", reports.treatmentCount],
    ["low_stock_count", reports.lowStockCount],
    ["average_survey", reports.averageSurvey.toFixed(2)]
  ];
  const csv = rows.map((row) => row.join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "cache-control": "private, no-store",
      "content-type": "text/csv; charset=utf-8",
      "x-content-type-options": "nosniff",
      "content-disposition": "attachment; filename=clinicnova-reports.csv"
    }
  });
}
