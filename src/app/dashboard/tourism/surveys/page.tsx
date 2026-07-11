import { MessageCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function TourismSurveysPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const [responses, patients, packages, leads, templates] = await Promise.all([
    prisma.surveyResponse.findMany({ where: { organizationId: session.organizationId, surveyTemplateId: { not: null } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.patient.findMany({ where: { organizationId: session.organizationId }, take: 200 }),
    prisma.tourismPackage.findMany({ where: { organizationId: session.organizationId }, take: 100 }),
    prisma.lead.findMany({ where: { organizationId: session.organizationId }, take: 200 }),
    prisma.surveyTemplate.findMany({ where: { organizationId: session.organizationId }, take: 20 })
  ]);
  const avg = responses.length ? (responses.reduce((sum, item) => sum + Number(item.rating ?? item.score), 0) / responses.length).toFixed(1) : "0";
  const nps = responses.length ? Math.round(responses.reduce((sum, item) => sum + Number(item.npsScore ?? 0), 0) / responses.length) : 0;
  const lowScores = responses.filter((item) => Number(item.rating ?? item.score) < 3 || Number(item.npsScore ?? 10) < 7);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={MessageCircle} title="Memnuniyet Anketleri" description="Tedavi sonrası anket sonuçları, NPS, düşük puan uyarıları ve turizm deneyimi kırılımları." />
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Ortalama memnuniyet</p><p className="mt-1 text-2xl font-semibold">{avg}/5</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">NPS</p><p className="mt-1 text-2xl font-semibold">{nps}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Düşük puan</p><p className="mt-1 text-2xl font-semibold text-red-600">{lowScores.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Şablon</p><p className="mt-1 text-2xl font-semibold">{templates.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Düşük Puan Uyarıları</CardTitle><CardDescription>Düşük puanda görev atama ve uyarı üretimi mock akışına bağlanır.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {lowScores.map((response) => {
            const patient = patients.find((item) => item.id === response.patientId);
            return (
              <div key={response.id} className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-red-900">
                <TriangleAlert className="mt-0.5 h-4 w-4" />
                <div><p className="font-medium">{patient ? `${patient.firstName} ${patient.lastName}` : response.patientId}</p><p className="text-sm">Puan: {response.rating ?? response.score}/5 · NPS {response.npsScore ?? "-"} · {response.comment}</p></div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Anket Cevapları</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Hasta</TableHead><TableHead>Ülke</TableHead><TableHead>Paket</TableHead><TableHead>Puan</TableHead><TableHead>NPS</TableHead><TableHead>Kaynak</TableHead><TableHead>Public Link</TableHead></TableRow></TableHeader>
            <TableBody>
              {responses.map((response) => {
                const patient = patients.find((item) => item.id === response.patientId);
                const tourismPackage = packages.find((item) => item.id === response.packageId);
                const lead = leads.find((item) => item.id === tourismPackage?.leadId);
                return (
                  <TableRow key={response.id}>
                    <TableCell>{patient ? `${patient.firstName} ${patient.lastName}` : response.patientId}</TableCell>
                    <TableCell>{lead?.country ?? "-"}</TableCell>
                    <TableCell>{tourismPackage?.packageTitle ?? "-"}</TableCell>
                    <TableCell><Badge variant={Number(response.rating ?? response.score) < 3 ? "danger" : "success"}>{response.rating ?? response.score}/5</Badge></TableCell>
                    <TableCell>{response.npsScore ?? "-"}</TableCell>
                    <TableCell>{statusLabel(response.source ?? undefined, locale)}</TableCell>
                    <TableCell>{tourismPackage ? <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={`/survey/${tourismPackage.publicToken}`}>Aç</Link> : "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
