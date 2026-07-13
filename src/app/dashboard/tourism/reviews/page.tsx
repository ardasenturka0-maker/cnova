import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Star, Send } from "lucide-react";
import { CommunicationChannel, IntegrationLogStatus, IntegrationProvider, ReviewRequestStatus } from "@prisma/client";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { writeIntegrationLog } from "@/lib/services/integrationLogService";
import { sendMessage } from "@/lib/services/notificationService";
import { formatDateTime } from "@/lib/utils";
import { statusTone } from "@/lib/tourism";

function resultUrl(type: "success" | "error", message: string) {
  return `/dashboard/tourism/reviews?${type}=${encodeURIComponent(message)}`;
}

async function sendReviewAction(id: string) {
  "use server";
  const session = await requireSession();
  const review = await prisma.reviewRequest.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!review) redirect(resultUrl("error", "Yorum isteği bulunamadı."));
  const patient = await prisma.patient.findFirst({ where: { id: review.patientId, organizationId: session.organizationId, deletedAt: null } });
  if (!patient) redirect(resultUrl("error", "Yorum isteğinin hastası bulunamadı."));

  const message = review.messageTemplate
    .replaceAll("{{name}}", patient.firstName)
    .replaceAll("{{reviewLink}}", review.reviewLink);
  const provider = review.platform === "GOOGLE" ? IntegrationProvider.GOOGLE_REVIEW : review.platform === "TRUSTPILOT" ? IntegrationProvider.TRUSTPILOT : IntegrationProvider.EMAIL;

  try {
    const delivery = await sendMessage({
      organizationId: session.organizationId,
      branchId: review.branchId ?? patient.branchId,
      patientId: patient.id,
      to: patient.phone,
      message,
      channel: CommunicationChannel.WHATSAPP,
      subject: "Tedavi deneyimi değerlendirmesi"
    });
    await prisma.reviewRequest.update({ where: { id }, data: { status: ReviewRequestStatus.SENT, sentAt: new Date() } });
    await writeIntegrationLog({
      organizationId: session.organizationId,
      branchId: review.branchId ?? patient.branchId,
      provider,
      eventType: "review.request.sent",
      payloadJson: { reviewId: id, patientId: patient.id, link: review.reviewLink },
      responseJson: delivery,
      status: IntegrationLogStatus.SUCCESS
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Yorum isteği sağlayıcıya teslim edilemedi.";
    await prisma.reviewRequest.update({ where: { id }, data: { status: ReviewRequestStatus.FAILED } });
    await writeIntegrationLog({
      organizationId: session.organizationId,
      branchId: review.branchId ?? patient.branchId,
      provider,
      eventType: "review.request.failed",
      payloadJson: { reviewId: id, patientId: patient.id, link: review.reviewLink },
      responseJson: { ok: false },
      status: IntegrationLogStatus.FAILED,
      errorMessage: message
    });
    revalidatePath("/dashboard/tourism/reviews");
    redirect(resultUrl("error", message));
  }
  revalidatePath("/dashboard/tourism/reviews");
  redirect(resultUrl("success", "Yorum isteği sağlayıcıya teslim edildi."));
}

export default async function ReviewsPage(props: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const [requests, patients] = await Promise.all([
    prisma.reviewRequest.findMany({ where: { organizationId: session.organizationId }, orderBy: { scheduledAt: "asc" }, take: 100 }),
    prisma.patient.findMany({ where: { organizationId: session.organizationId, deletedAt: null }, take: 200 })
  ]);
  const successCount = requests.filter((item) => ["CLICKED", "COMPLETED"].includes(item.status)).length;
  const successRate = requests.length ? Math.round((successCount / requests.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Star} title="Yorum Yönetimi" description="Tedavi tamamlandıktan sonra memnun hastaya Google / Trustpilot yorum isteği gönder." />
      {searchParams.success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{searchParams.success}</div> : null}
      {searchParams.error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{searchParams.error}</div> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Toplam istek</p><p className="mt-1 text-2xl font-semibold">{requests.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Başarı oranı</p><p className="mt-1 text-2xl font-semibold">%{successRate}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Bekleyen</p><p className="mt-1 text-2xl font-semibold">{requests.filter((item) => item.status === ReviewRequestStatus.SCHEDULED).length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Gönderim İlkesi</CardTitle><CardDescription>Her isteğin doğrulanmış yorum adresi ve mesaj şablonu otomasyon akışından gelir; teslimat başarısızsa durum FAILED olarak kaydedilir.</CardDescription></CardHeader>
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
