import { BarChart3, Download } from "lucide-react";
import Link from "next/link";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { TreatmentStatusBadge } from "@/components/dashboard/treatment-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "@/components/ui/print-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireModuleAccess } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getReports } from "@/lib/services/reportService";
import { countCompletedTreatmentHistory, getCompletedTreatmentHistory } from "@/lib/services/treatmentHistoryService";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export default async function ReportsPage(props: { searchParams: Promise<{ treatmentPage?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await requireModuleAccess("reports");
  const locale = await getLocale();
  const [reports, completedTreatmentCount] = await Promise.all([
    getReports(session.organizationId),
    countCompletedTreatmentHistory(session.organizationId)
  ]);
  const treatmentPageSize = 50;
  const treatmentPages = Math.max(1, Math.ceil(completedTreatmentCount / treatmentPageSize));
  const requestedTreatmentPage = Math.max(1, Number.parseInt(searchParams.treatmentPage ?? "1", 10) || 1);
  const treatmentPage = Math.min(requestedTreatmentPage, treatmentPages);
  const completedTreatments = await getCompletedTreatmentHistory(session.organizationId, { take: treatmentPageSize, skip: (treatmentPage - 1) * treatmentPageSize });

  const cards = [
    ["Toplam tahsilat", formatCurrency(reports.revenue, locale)],
    ["Toplam gider", formatCurrency(reports.expense, locale)],
    ["Net nakit", formatCurrency(reports.netRevenue, locale)],
    ["Bekleyen tahsilat", formatCurrency(reports.pendingRevenue, locale)],
    ["Doktor/Tedavi", String(reports.treatmentCount)],
    ["Randevu gelmeme", `%${reports.noShowRate}`],
    ["İptal oranı", `%${reports.cancellationRate}`],
    ["Stok uyarısı", String(reports.lowStockCount)],
    ["Tamamlanan tedavi", String(completedTreatmentCount)]
  ];

  return (
    <div className="space-y-6">
      <ModuleHeader icon={BarChart3} title="Raporlama" description="Gelir, doktor performansı, doluluk, iptal, tamamlanan tedaviler, stok ve şube karşılaştırması." />
      <div className="flex flex-wrap gap-2">
        <Link className={cn(buttonVariants(), "gap-2")} href="/api/reports/export"><Download className="h-4 w-4" />CSV indir</Link>
        <PrintButton />
      </div>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></CardContent></Card>
        ))}
      </div>
      <Card id="tamamlanan-tedaviler">
        <CardHeader><CardTitle>Kişi bazlı geçmiş tedaviler</CardTitle><p className="text-sm text-muted-foreground">Bitirilen {completedTreatmentCount} tedavi kişi ve işlem tarihine göre otomatik listelenir.</p></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Hasta</TableHead><TableHead>İşlem tarihi</TableHead><TableHead>Tedavi</TableHead><TableHead>Hekim</TableHead><TableHead>Şube</TableHead><TableHead>Ücret</TableHead><TableHead>Durum</TableHead></TableRow></TableHeader>
            <TableBody>
              {completedTreatments.map((treatment) => <TableRow key={treatment.id}>
                <TableCell><Link className="font-medium text-primary hover:underline" href={`/dashboard/patients/${treatment.patientId}`}>{treatment.patient.firstName} {treatment.patient.lastName}</Link></TableCell>
                <TableCell>{formatDate(treatment.performedAt, locale)}</TableCell>
                <TableCell>{treatment.treatmentType}{treatment.toothNumber ? ` · Diş ${treatment.toothNumber}` : ""}</TableCell>
                <TableCell>{treatment.doctor.name}</TableCell>
                <TableCell>{treatment.branch.name}</TableCell>
                <TableCell>{formatCurrency(treatment.fee, locale)}</TableCell>
                <TableCell><TreatmentStatusBadge status={treatment.status} locale={locale} /></TableCell>
              </TableRow>)}
              {!completedTreatments.length ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Bitirilen tedaviler otomatik olarak bu kişi raporuna eklenir.</TableCell></TableRow> : null}
            </TableBody>
          </Table>
          {treatmentPages > 1 ? <div className="flex items-center justify-between gap-3 border-t p-4 text-sm">
            <span className="text-muted-foreground">Sayfa {treatmentPage} / {treatmentPages}</span>
            <div className="flex gap-2">
              {treatmentPage > 1 ? <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={`/dashboard/reports?treatmentPage=${treatmentPage - 1}#tamamlanan-tedaviler`}>Önceki</Link> : null}
              {treatmentPage < treatmentPages ? <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={`/dashboard/reports?treatmentPage=${treatmentPage + 1}#tamamlanan-tedaviler`}>Sonraki</Link> : null}
            </div>
          </div> : null}
        </CardContent>
      </Card>
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
