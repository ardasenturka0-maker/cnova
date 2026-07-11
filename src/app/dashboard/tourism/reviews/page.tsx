import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Star, Send } from "lucide-react";
import { IntegrationProvider, ReviewRequestStatus } from "@prisma/client";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { writeIntegrationLog } from "@/lib/services/integrationLogService";
import { formatDateTime } from "@/lib/utils";
import { statusTone } from "@/lib/tourism";

function resultUrl(message: string) {
  return `/dashboard/tourism/reviews?success=${encodeURIComponent(message)}`;
}

async function sendReviewAction(id: string) {
  "use server";
  const session = await requireSession();
  const review = await prisma.reviewRequest.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!review) redirect(resultUrl("Yorum isteği bulunamadı."));
  await prisma.reviewRequest.update({ where: { id }, data: { status: ReviewRequestStatus.SENT, sentAt: new Date() } });
  await writeIntegrationLog({
    organizationId: session.organizationId,
    branchId: review.branchId,
    provider: review.platform === "GOOGLE" ? IntegrationProvider.GOOGLE_REVIEW : review.platform === "TRUSTPILOT" ? IntegrationProvider.TRUSTPILOT : IntegrationProvider.EMAIL,
    eventType: "review.request.sent",
    payloadJson: { reviewId: id, link: review.reviewLink },
    responseJson: { queued: true, mode: "mock" }
  });
  revalidatePath("/dashboard/tourism/reviews");
  redirect(resultUrl("Yorum isteği mock olarak gönderildi."));
}

export default async function ReviewsPage(props: { searchParams: Promise<{ success?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const [requests, patients] = await Promise.all([
    prisma.reviewRequest.findMany({ where: { organizationId: session.organizationId }, orderBy: { scheduledAt: "asc" }, take: 100 }),
    prisma.patient.findMany({ where: { organizationId: session.organizationId }, take: 200 })
  ]);
  const successCount = requests.filter((item) => ["CLICKED", "COMPLETED"].includes(item.status)).length;
  const successRate = requests.length ? Math.round((successCount / requests.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Star} title="Yorum Yönetimi" description="Tedavi tamamlandıktan sonra memnun hastaya Google / Trustpilot yorum isteği gönder." />
      {searchParams.success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{searchParams.success}</div> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Toplam istek</p><p className="mt-1 text-2xl font-semibold">{requests.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Başarı oranı</p><p className="mt-1 text-2xl font-semibold">%{successRate}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Bekleyen</p><p className="mt-1 text-2xl font-semibold">{requests.filter((item) => item.status === ReviewRequestStatus.SCHEDULED).length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Yorum Linki Ayarları</CardTitle><CardDescription>Mock ayar formu; gerçek Google/Trustpilot entegrasyonunda provider config’e bağlanır.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2"><Label>Google yorum linki</Label><Input defaultValue="https://reviews.google.test/clinicnova" /></div>
          <div className="space-y-2 md:col-span-2"><Label>Trustpilot linki</Label><Input defaultValue="https://trustpilot.test/clinicnova" /></div>
          <div className="space-y-2"><Label>Tedavi bitiminden sonra</Label><Input type="number" defaultValue={7} /></div>
          <div className="space-y-2"><Label>Platform</Label><Select defaultValue="GOOGLE"><option>GOOGLE</option><option>TRUSTPILOT</option><option>CUSTOM</option></Select></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Gönderilen / Planlanan Yorum İstekleri</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Hasta</TableHead><TableHead>Platform</TableHead><TableHead>Plan</TableHead><TableHead>Gönderim</TableHead><TableHead>Durum</TableHead><TableHead>Dil</TableHead><TableHead>Aksiyon</TableHead></TableRow></TableHeader>
            <TableBody>
              {requests.map((request) => {
                const patient = patients.find((item) => item.id === request.patientId);
                return (
                  <TableRow key={request.id}>
                    <TableCell>{patient ? `${patient.firstName} ${patient.lastName}` : request.patientId}</TableCell>
                    <TableCell>{request.platform}</TableCell>
                    <TableCell>{formatDateTime(request.scheduledAt, locale)}</TableCell>
                    <TableCell>{request.sentAt ? formatDateTime(request.sentAt, locale) : "-"}</TableCell>
                    <TableCell><Badge variant={statusTone(request.status)}>{statusLabel(request.status, locale)}</Badge></TableCell>
                    <TableCell>{request.language}</TableCell>
                    <TableCell><form action={sendReviewAction.bind(null, request.id)}><Button size="sm" variant="outline"><Send className="h-4 w-4" />Gönder</Button></form></TableCell>
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
