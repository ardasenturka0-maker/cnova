import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getReports } from "@/lib/services/reportService";

export async function GET() {
  const session = await requireSession();
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
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=clinicnova-reports.csv"
    }
  });
}
