import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("removed engagement modules no longer appear in dashboard navigation or quick actions", () => {
  const navigation = source("src/lib/dashboard-navigation.ts");
  const dashboard = source("src/app/dashboard/page.tsx");
  const surveys = source("src/app/dashboard/surveys/page.tsx");
  const recalls = source("src/app/dashboard/recalls/page.tsx");
  for (const route of ["/dashboard/surveys", "/dashboard/communication", "/dashboard/recalls"]) {
    assert.doesNotMatch(navigation, new RegExp(route));
  }
  assert.doesNotMatch(dashboard, /WhatsApp gönder|metrics\.recalls|Takip listesi/);
  assert.match(surveys, /redirect\("\/dashboard"\)/);
  assert.match(recalls, /redirect\("\/dashboard"\)/);
});

test("dashboard KPIs expose clickable summaries and daily tasks disappear through a scoped completion action", () => {
  const dashboard = source("src/app/dashboard/page.tsx");
  const kpis = source("src/components/dashboard/dashboard-kpi-summaries.tsx");
  const todo = source("src/components/dashboard/daily-clinic-todo.tsx");
  const tasks = source("src/lib/services/dailyTaskService.ts");
  assert.match(dashboard, /DashboardKpiSummaries cards=\{kpiCards\}/);
  assert.match(kpis, /aria-expanded=\{open\}/);
  assert.match(kpis, /Özeti \{open \? "kapat" : "göster"\}/);
  assert.match(todo, /completeAction\.bind\(null, task\.id\)/);
  assert.match(tasks, /data: \{ status: TaskStatus\.DONE \}/);
  assert.match(tasks, /@@unique|organizationId_sourceKey|sourceKey: \{ startsWith: prefix \}/);
  assert.match(tasks, /canAccessDailyTask\(role, task\.sourceKey/);
  assert.match(tasks, /clinic-daily:\$\{branchId \?\? "all"\}:\$\{dateKey\}:/);
  assert.match(dashboard, /session\.branchId, session\.role/);
  assert.match(dashboard, /getDashboardMetrics\(session\.organizationId, \{ branchId: session\.branchId, role: session\.role \}\)/);
  assert.match(dashboard, /canAccess\(session\.role, card\.permission\)/);
  assert.match(source("src/lib/services/reportService.ts"), /paidAt: \{ gte: monthStart, lt: nextMonthStart \}/);
});

test("treatment workflow supports editing, explicit finishing and canonical completed history views", () => {
  const treatments = source("src/app/dashboard/treatments/page.tsx");
  const patient = source("src/app/dashboard/patients/[id]/page.tsx");
  const reports = source("src/app/dashboard/reports/page.tsx");
  assert.match(treatments, /updateTreatmentRecord\(session\.organizationId, treatmentId, parsed\.data\)/);
  assert.match(treatments, /Tedaviyi bitir/);
  assert.match(treatments, /Tedaviyi yeniden aç/);
  assert.match(treatments, /id="gecmis-tedaviler"/);
  assert.match(treatments, /status: TreatmentStatus\.COMPLETED/);
  assert.match(treatments, /skip: \(historyPage - 1\) \* historyPageSize/);
  assert.match(patient, /getCompletedTreatmentHistory\(session\.organizationId/);
  assert.match(patient, /Geçmiş tedaviler/);
  assert.match(reports, /Kişi bazlı geçmiş tedaviler/);
  assert.doesNotMatch(patient, /Onam, anket ve recall|memnuniyet anketi|takip kaydı/);
});

test("payment-plan UI explains remaining balance and renders an installment calendar", () => {
  const builder = source("src/components/dashboard/payment-plan-builder.tsx");
  const treatments = source("src/app/dashboard/treatments/page.tsx");
  const plans = source("src/app/dashboard/treatment-plans/page.tsx");
  assert.match(builder, /Taksitlenecek bakiye/);
  assert.match(builder, /Taksit takvimi/);
  assert.match(builder, /Peşinat toplam bedelden büyük olamaz/);
  assert.match(builder, /formatCurrencyPrecise/);
  assert.match(treatments, /PaymentPlanBuilder totalName="fee"/);
  assert.match(plans, /PaymentPlanBuilder totalName="estimatedFee"/);
});

test("stock soft deletion is role-scoped and deleted stock is restorable from the shared trash", () => {
  const stocks = source("src/app/dashboard/stocks/page.tsx");
  const trash = source("src/app/dashboard/patients/trash/page.tsx");
  assert.match(stocks, /if \(!canManageTrash\(session\.role\)\) redirect/);
  assert.match(stocks, /softDeleteStockItem\(session\.organizationId, itemId, session\.userId, session\.branchId\)/);
  assert.match(trash, /getDeletedStockItems\(session\.organizationId, \{ page: stockPage, branchId: session\.branchId \}\)/);
  assert.match(trash, /stockTrash\.items/);
  assert.match(trash, /stockTrash\.totalPages/);
  assert.match(trash, /restoreStockItem\(session\.organizationId, id, session\.userId, session\.branchId\)/);
  assert.match(trash, /Silinen stoklar/);
});
