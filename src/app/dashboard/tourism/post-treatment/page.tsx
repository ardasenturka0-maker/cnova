import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HeartPulse, Send, TriangleAlert } from "lucide-react";
import { IntegrationProvider, PostTreatmentFollowUpStatus } from "@prisma/client";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { writeIntegrationLog } from "@/lib/services/integrationLogService";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { statusTone } from "@/lib/tourism";

function resultUrl(message: string) {
  return `/dashboard/tourism/post-treatment?success=${encodeURIComponent(message)}`;
}

async function sendCareMessageAction(id: string) {
  "use server";
  const session = await requireSession();
  const followUp = await prisma.postTreatmentFollowUp.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!followUp) redirect(resultUrl("Takip kaydı bulunamadı."));
  await prisma.postTreatmentFollowUp.update({ where: { id }, data: { status: PostTreatmentFollowUpStatus.SENT, nextMessageAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
  await writeIntegrationLog({
    organizationId: session.organizationId,
    branchId: followUp.branchId,
    provider: IntegrationProvider.WHATSAPP,
    eventType: "post-care.sent",
    payloadJson: { followUpId: id, link: `/care-check/${followUp.publicToken}` },
    responseJson: { queued: true, mode: "mock" }
  });
  revalidatePath("/dashboard/tourism/post-treatment");
  redirect(resultUrl("Tedavi sonrası bakım mesajı mock gönderildi."));
}

export default async function PostTreatmentPage(props: { searchParams: Promise<{ success?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const [followUps, patients, packages] = await Promise.all([
    prisma.postTreatmentFollowUp.findMany({ where: { organizationId: session.organizationId }, orderBy: { nextMessageAt: "asc" }, take: 100 }),
    prisma.patient.findMany({ where: { organizationId: session.organizationId }, take: 200 }),
    prisma.tourismPackage.findMany({ where: { organizationId: session.organizationId }, take: 100 })
  ]);
  const issues = followUps.filter((item) => item.issueReported);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={HeartPulse} title="Tedavi Sonrası Takip" description="Hasta ülkesine döndükten sonra otomatik bakım mesajı, sorun bildirme ve hekim aksiyonu." />
      {searchParams.success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{searchParams.success}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Planlı bakım</p><p className="mt-1 text-2xl font-semibold">{followUps.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Sorun bildiren</p><p className="mt-1 text-2xl font-semibold text-red-600">{issues.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Bugün mesaj bekleyen</p><p className="mt-1 text-2xl font-semibold">{followUps.filter((item) => item.nextMessageAt <= new Date()).length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Kırmızı Uyarılar</CardTitle><CardDescription>Sorun bildirirse doktor görevi ve communication kaydı üretilecek akışın görünümü.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {issues.map((item) => {
            const patient = patients.find((entry) => entry.id === item.patientId);
            return (
              <div key={item.id} className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-red-900">
                <TriangleAlert className="mt-0.5 h-4 w-4" />
                <div><p className="font-medium">{patient ? `${patient.firstName} ${patient.lastName}` : item.patientId}</p><p className="text-sm">{item.issueDescription} · Ağrı seviyesi {item.painLevel ?? "-"}</p></div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bakım Takipleri</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Hasta</TableHead><TableHead>Paket</TableHead><TableHead>Dönüş Ülkesi</TableHead><TableHead>Gün</TableHead><TableHead>Sonraki Mesaj</TableHead><TableHead>Durum</TableHead><TableHead>Link</TableHead><TableHead>Aksiyon</TableHead></TableRow></TableHeader>
            <TableBody>
              {followUps.map((item) => {
                const patient = patients.find((entry) => entry.id === item.patientId);
                const tourismPackage = packages.find((entry) => entry.id === item.packageId);
                return (
                  <TableRow key={item.id}>
                    <TableCell>{patient ? `${patient.firstName} ${patient.lastName}` : item.patientId}</TableCell>
                    <TableCell>{tourismPackage?.packageTitle ?? "-"}</TableCell>
                    <TableCell>{item.returnCountry}<div className="text-xs text-muted-foreground">{formatDate(item.returnDate, locale)}</div></TableCell>
                    <TableCell>{item.followUpDay}. gün</TableCell>
                    <TableCell>{formatDateTime(item.nextMessageAt, locale)}</TableCell>
                    <TableCell><Badge variant={statusTone(item.status)}>{statusLabel(item.status, locale)}</Badge></TableCell>
                    <TableCell><Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={`/care-check/${item.publicToken}`}>Aç</Link></TableCell>
                    <TableCell><form action={sendCareMessageAction.bind(null, item.id)}><Button size="sm" variant="outline"><Send className="h-4 w-4" />Gönder</Button></form></TableCell>
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
