import { ChartNoAxesCombined } from "lucide-react";
import { TourismLeadStatus, TourismPackageStatus } from "@prisma/client";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { leadStatusLabel, sourceLabel } from "@/lib/tourism";

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
}

function TopBars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...entries.map((entry) => entry[1]));
  return (
    <div className="space-y-3">
      {entries.map(([label, value]) => (
        <div key={label}>
          <div className="mb-1 flex justify-between text-sm"><span>{label}</span><strong>{value}</strong></div>
          <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export default async function TourismAnalyticsPage() {
  const session = await requireSession();
  const locale = getLocale();
  const [leads, packages, followUps, reviews, surveys] = await Promise.all([
    prisma.lead.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.tourismPackage.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.leadFollowUp.findMany({ where: { organizationId: session.organizationId }, take: 200 }),
    prisma.reviewRequest.findMany({ where: { organizationId: session.organizationId }, take: 200 }),
    prisma.surveyResponse.findMany({ where: { organizationId: session.organizationId, surveyTemplateId: { not: null } }, take: 200 })
  ]);
  const accepted = packages.filter((item) => item.packageStatus === TourismPackageStatus.ACCEPTED).length;
  const sentStatuses: TourismPackageStatus[] = [TourismPackageStatus.SENT, TourismPackageStatus.VIEWED, TourismPackageStatus.ACCEPTED];
  const bookedStatuses: TourismLeadStatus[] = [TourismLeadStatus.BOOKED, TourismLeadStatus.TREATMENT_STARTED, TourismLeadStatus.TREATMENT_COMPLETED];
  const sent = packages.filter((item) => sentStatuses.includes(item.packageStatus)).length;
  const booked = leads.filter((item) => bookedStatuses.includes(item.leadStatus)).length;
  const conversion = leads.length ? Math.round((booked / leads.length) * 100) : 0;
  const revenue = packages.reduce((sum, item) => sum + Number(item.finalPrice), 0);
  const avgPackage = packages.length ? revenue / packages.length : 0;
  const avgSurvey = surveys.length ? (surveys.reduce((sum, item) => sum + Number(item.rating ?? item.score), 0) / surveys.length).toFixed(1) : "0";
  const nps = surveys.length ? Math.round(surveys.reduce((sum, item) => sum + Number(item.npsScore ?? 0), 0) / surveys.length) : 0;
  const channelData = countBy(leads.map((item) => sourceLabel(item.sourceChannel, locale)));
  const countryData = countBy(leads.map((item) => item.country));
  const treatmentData = countBy(leads.map((item) => item.interestedTreatment));
  const funnel = Object.values(TourismLeadStatus).map((status) => ({ status, count: leads.filter((lead) => lead.leadStatus === status).length }));
  const hotLeads = leads.filter((lead) => lead.leadScore >= 80).slice(0, 10);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={ChartNoAxesCombined} title="Turizm Analitikleri" description="Ülke, kanal, tedavi ve gelir performansıyla satış kaybı noktalarını görünür yapar." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Bu ay lead</p><p className="mt-1 text-2xl font-semibold">{leads.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Paket gönderilen</p><p className="mt-1 text-2xl font-semibold">{sent}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Kabul edilen</p><p className="mt-1 text-2xl font-semibold">{accepted}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Dönüşüm</p><p className="mt-1 text-2xl font-semibold">%{conversion}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Ortalama paket</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(avgPackage, locale)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Beklenen gelir</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(revenue, locale)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Memnuniyet</p><p className="mt-1 text-2xl font-semibold">{avgSurvey}/5</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">NPS</p><p className="mt-1 text-2xl font-semibold">{nps}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card><CardHeader><CardTitle>Kanal Dağılımı</CardTitle></CardHeader><CardContent><TopBars data={channelData} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Ülke Dağılımı</CardTitle></CardHeader><CardContent><TopBars data={countryData} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Tedavi Talebi</CardTitle></CardHeader><CardContent><TopBars data={treatmentData} /></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Lead Funnel</CardTitle><CardDescription>NEW → CONTACTED → QUALIFIED → PACKAGE_SENT → BOOKED → COMPLETED akışında kayıp noktaları.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {funnel.map((item) => (
            <div key={item.status} className="rounded-md border bg-background p-3">
              <p className="text-xs text-muted-foreground">{leadStatusLabel(item.status, locale)}</p>
              <p className="mt-1 text-2xl font-semibold">{item.count}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>En Sıcak Lead’ler</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Lead</TableHead><TableHead>Ülke</TableHead><TableHead>Tedavi</TableHead><TableHead>Skor</TableHead></TableRow></TableHeader>
              <TableBody>{hotLeads.map((lead) => <TableRow key={lead.id}><TableCell>{lead.fullName}</TableCell><TableCell>{lead.country}</TableCell><TableCell>{lead.interestedTreatment}</TableCell><TableCell><Badge>{lead.leadScore}</Badge></TableCell></TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Follow-up ve Yorum Performansı</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Follow-up sonrası aktif kayıt</span><strong>{followUps.length}</strong></div>
            <div className="flex justify-between"><span>Yorum isteği başarı</span><strong>{reviews.filter((item) => ["CLICKED", "COMPLETED"].includes(item.status)).length}/{reviews.length}</strong></div>
            <div className="flex justify-between"><span>Paket gönderilip cevap bekleyen</span><strong>{packages.filter((item) => ["SENT", "VIEWED"].includes(item.packageStatus)).length}</strong></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
