import { BarChart3, Download } from "lucide-react";
import Link from "next/link";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "@/components/ui/print-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getReports } from "@/lib/services/reportService";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export default async function ReportsPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const reports = await getReports(session.organizationId);

  const cards = [
    ["Aylık gelir", formatCurrency(reports.revenue, locale)],
    ["Toplam gider", formatCurrency(reports.expense, locale)],
    ["Net nakit", formatCurrency(reports.netRevenue, locale)],
    ["Bekleyen tahsilat", formatCurrency(reports.pendingRevenue, locale)],
    ["Doktor/Tedavi", String(reports.treatmentCount)],
    ["Randevu gelmeme", `%${reports.noShowRate}`],
    ["İptal oranı", `%${reports.cancellationRate}`],
    ["Stok uyarısı", String(reports.lowStockCount)],
    ["Memnuniyet", reports.averageSurvey.toFixed(1)]
  ];

  return (
    <div className="space-y-6">
      <ModuleHeader icon={BarChart3} title="Raporlama" description="Gelir, doktor performansı, doluluk, iptal, tedavi dağılımı, stok, memnuniyet ve şube karşılaştırması." />
      <div className="flex flex-wrap gap-2">
        <Link className={cn(buttonVariants(), "gap-2")} href="/api/reports/export"><Download className="h-4 w-4" />CSV indir</Link>
        <PrintButton />
      </div>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></CardContent></Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>12 aylık nakit akışı</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Ay</TableHead><TableHead>Gelir</TableHead><TableHead>Gider</TableHead><TableHead>Net</TableHead></TableRow></TableHeader><TableBody>{reports.monthlyCashflow.map((row) => <TableRow key={row.month}><TableCell>{row.month}</TableCell><TableCell>{formatCurrency(row.income, locale)}</TableCell><TableCell>{formatCurrency(row.expense, locale)}</TableCell><TableCell>{formatCurrency(row.income - row.expense, locale)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle>Doktor performansı</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Doktor</TableHead><TableHead>Tedavi</TableHead><TableHead>Planlanan ciro</TableHead></TableRow></TableHeader><TableBody>{reports.doctorPerformance.map((row) => <TableRow key={row.doctor}><TableCell>{row.doctor}</TableCell><TableCell>{row.treatments}</TableCell><TableCell>{formatCurrency(row.plannedRevenue, locale)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle>Tedavi dağılımı</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Tedavi</TableHead><TableHead>Adet</TableHead><TableHead>Planlanan ciro</TableHead></TableRow></TableHeader><TableBody>{reports.treatmentDistribution.map((row) => <TableRow key={row.name}><TableCell>{row.name}</TableCell><TableCell>{row.count}</TableCell><TableCell>{formatCurrency(row.revenue, locale)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle>Randevu durumları</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Durum</TableHead><TableHead>Adet</TableHead></TableRow></TableHeader><TableBody>{reports.appointmentStatuses.map((row) => <TableRow key={row.status}><TableCell>{statusLabel(row.status, locale)}</TableCell><TableCell>{row.count}</TableCell></TableRow>)}</TableBody></Table><div className="border-t p-4 text-sm">Stoktaki toplam malzeme değeri: <strong>{formatCurrency(reports.stockValue, locale)}</strong></div></CardContent></Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Şube karşılaştırması</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Şube</TableHead><TableHead>Gelir</TableHead><TableHead>Randevu</TableHead></TableRow></TableHeader>
              <TableBody>
                {reports.branchComparison.map((branch) => (
                  <TableRow key={branch.branch}><TableCell>{branch.branch}</TableCell><TableCell>{formatCurrency(branch.revenue, locale)}</TableCell><TableCell>{branch.appointments}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Snapshot raporları</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {reports.snapshots.map((snapshot) => (
              <div key={snapshot.id} className="rounded-md border bg-background p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{snapshot.title}</div>
                  <Badge variant="muted">{snapshot.type}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{formatDate(snapshot.periodStart, locale)} - {formatDate(snapshot.periodEnd, locale)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
