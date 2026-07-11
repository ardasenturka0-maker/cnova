import { Plane, PackageCheck, Repeat, TrendingUp, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { compactStatusLabel, leadStatusLabel, packageStatusLabel, sourceLabel, statusTone, tourismKpiTarget } from "@/lib/tourism";
import { TourismLeadStatus, TourismPackageStatus } from "@prisma/client";

const workflow = [
  "Instagram / WhatsApp / Web lead",
  "Lead havuzuna düşer",
  "Satış temsilcisi sahiplenir",
  "Tedavi + otel + transfer paketi",
  "Paket hastaya gönderilir",
  "3/7/14 otomatik takip",
  "Kabul sonrası BOOKED",
  "n8n otel/transfer paylaşımı",
  "Tedavi tamamlanır",
  "Ülkeye dönüş bakım mesajı",
  "Memnuniyet anketi",
  "Google / Trustpilot yorum isteği",
  "Onaylı önce/sonra galeri",
  "Ülke, kanal, tedavi ve gelir analitiği"
];

export default async function TourismDashboardPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const [leads, packages, followUps, reservations, postCare, reviews, tasks] = await Promise.all([
    prisma.lead.findMany({ where: { organizationId: session.organizationId }, orderBy: { leadScore: "desc" }, take: 60 }),
    prisma.tourismPackage.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.leadFollowUp.findMany({ where: { organizationId: session.organizationId }, orderBy: { nextRunAt: "asc" }, take: 20 }),
    prisma.reservationShare.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.postTreatmentFollowUp.findMany({ where: { organizationId: session.organizationId }, orderBy: { nextMessageAt: "asc" }, take: 10 }),
    prisma.reviewRequest.findMany({ where: { organizationId: session.organizationId }, orderBy: { scheduledAt: "asc" }, take: 10 }),
    prisma.task.findMany({ where: { organizationId: session.organizationId }, orderBy: { dueDate: "asc" }, take: 10 })
  ]);

  const sentPackageStatuses: TourismPackageStatus[] = [TourismPackageStatus.SENT, TourismPackageStatus.VIEWED, TourismPackageStatus.ACCEPTED];
  const waitingLeadStatuses: TourismLeadStatus[] = [TourismLeadStatus.WAITING_REPLY, TourismLeadStatus.PACKAGE_SENT, TourismLeadStatus.QUALIFIED];
  const noReplyPackageStatuses: TourismPackageStatus[] = [TourismPackageStatus.SENT, TourismPackageStatus.VIEWED];
  const sentPackages = packages.filter((item) => sentPackageStatuses.includes(item.packageStatus)).length;
  const bookedLeads = leads.filter((lead) => lead.leadStatus === TourismLeadStatus.BOOKED || lead.leadStatus === TourismLeadStatus.TREATMENT_COMPLETED).length;
  const conversion = leads.length ? Math.round((bookedLeads / leads.length) * 100) : 0;
  const expectedRevenue = packages.reduce((sum, item) => sum + Number(item.finalPrice), 0);
  const waiting = leads.filter((lead) => waitingLeadStatuses.includes(lead.leadStatus)).slice(0, 6);
  const packageNoReply = packages.filter((item) => noReplyPackageStatuses.includes(item.packageStatus)).slice(0, 6);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Plane} title="Sağlık Turizmi" description="Lead kaybını azaltan uçtan uca satış, paket, takip, rezervasyon, bakım, yorum ve analitik akışı." actionHref="/dashboard/tourism/leads" actionLabel="Lead Havuzuna Git" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Toplam lead" value={String(leads.length)} detail={tourismKpiTarget.promise} icon={TrendingUp} tone="primary" />
        <StatCard title="Paket gönderilen" value={String(sentPackages)} detail={`${packages.length} paket üretildi`} icon={PackageCheck} tone="accent" />
        <StatCard title="Rezervasyon dönüşümü" value={`%${conversion}`} detail={`${bookedLeads} lead satışa döndü`} icon={ArrowRight} tone="success" />
        <StatCard title="Beklenen gelir" value={formatCurrency(expectedRevenue, locale)} detail="Paket toplam potansiyeli" icon={Repeat} tone="warning" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Satış Kaybını Azaltan Ana Akış</CardTitle>
          <CardDescription>Her adım sonraki aksiyona bağlıdır; cevap gelmeyen noktalar follow-up ve görev üretir.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {workflow.map((step, index) => (
              <div key={step} className="rounded-md border bg-background p-3">
                <div className="flex items-center gap-2">
                  <Badge variant={index < 7 ? "success" : "default"}>{index + 1}</Badge>
                  <p className="text-sm font-medium">{step}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sıcak Lead’ler</CardTitle>
            <CardDescription>Skoru yüksek veya cevap bekleyen lead’ler satış ekibinin ilk işi olmalı.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Lead</TableHead><TableHead>Kanal</TableHead><TableHead>Tedavi</TableHead><TableHead>Durum</TableHead><TableHead>Skor</TableHead></TableRow></TableHeader>
              <TableBody>
                {leads.slice(0, 8).map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell><div className="font-medium">{lead.fullName}</div><div className="text-xs text-muted-foreground">{lead.country}</div></TableCell>
                    <TableCell>{sourceLabel(lead.sourceChannel, locale)}</TableCell>
                    <TableCell>{lead.interestedTreatment}</TableCell>
                    <TableCell><Badge variant={statusTone(lead.leadStatus)}>{leadStatusLabel(lead.leadStatus, locale)}</Badge></TableCell>
                    <TableCell className="font-semibold">{lead.leadScore}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cevap Bekleyen Satış Fırsatları</CardTitle>
            <CardDescription>Follow-up veya kişisel temas gerektiren lead ve paketler.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {waiting.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between rounded-md border bg-background p-3">
                  <div><p className="text-sm font-medium">{lead.fullName}</p><p className="text-xs text-muted-foreground">{lead.interestedTreatment} · {formatDate(lead.nextFollowUpAt ?? lead.createdAt, locale)}</p></div>
                  <Badge variant={statusTone(lead.leadStatus)}>{leadStatusLabel(lead.leadStatus, locale)}</Badge>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {packageNoReply.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-md border bg-background p-3">
                  <div><p className="text-sm font-medium">{item.packageTitle}</p><p className="text-xs text-muted-foreground">{formatCurrency(item.finalPrice, locale)} · geçerlilik {formatDate(item.validUntil ?? item.createdAt, locale)}</p></div>
                  <Badge variant={statusTone(item.packageStatus)}>{packageStatusLabel(item.packageStatus, locale)}</Badge>
                </div>
              ))}
            </div>
            <Link className={cn(buttonVariants({ variant: "outline" }), "w-fit")} href="/dashboard/tourism/followups">Takip planını aç</Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Operasyon Durumu</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Rezervasyon paylaşımları</span><strong>{reservations.length}</strong></div>
            <div className="flex justify-between"><span>Aktif follow-up</span><strong>{followUps.length}</strong></div>
            <div className="flex justify-between"><span>Bakım takipleri</span><strong>{postCare.length}</strong></div>
            <div className="flex justify-between"><span>Yorum istekleri</span><strong>{reviews.length}</strong></div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Görev ve Riskler</CardTitle><CardDescription>Lead kaybını azaltmak için otomatik üretilen ekip görevleri.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-start gap-3 rounded-md border bg-background p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.description ?? "Açıklama yok"} · {compactStatusLabel(task.status, locale)}</p>
                </div>
                <Badge variant={task.priority === "URGENT" ? "danger" : "warning"}>{statusLabel(task.priority, locale)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
