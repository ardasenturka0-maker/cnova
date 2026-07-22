import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ClipboardCheck, Send } from "lucide-react";
import { CommunicationChannel, ConsentStatus, DigitalConsentStatus } from "@prisma/client";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "@/components/ui/print-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireModuleAccess } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { publicErrorMessage } from "@/lib/public-error";
import { sendMessage } from "@/lib/services/notificationService";
import { consentSchema } from "@/lib/validations/engagement";
import { formatDateTime } from "@/lib/utils";

function resultUrl(type: "success" | "error", message: string) {
  return `/dashboard/consents?${type}=${encodeURIComponent(message)}`;
}

async function createConsentAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("consents");
  const parsed = consentSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect(resultUrl("error", parsed.error.issues[0]?.message ?? "Onam formu geçersiz."));
  }

  const payload = parsed.data;
  const patient = await prisma.patient.findFirst({ where: { id: payload.patientId, organizationId: session.organizationId, deletedAt: null }, select: { branchId: true } });

  if (!patient) {
    redirect(resultUrl("error", "Seçilen hasta bulunamadı veya bu kliniğe ait değil."));
  }

  try {
    await prisma.consent.create({
      data: {
        patientId: payload.patientId,
        templateName: payload.templateName,
        content: payload.content,
        status: payload.status as ConsentStatus,
        timestamp: new Date(),
        signedAt: payload.status === "SIGNED" ? new Date() : null,
        organizationId: session.organizationId,
        branchId: patient.branchId
      }
    });
  } catch {
    redirect(resultUrl("error", "Onam kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin."));
  }

  revalidatePath("/dashboard/consents");
  redirect(resultUrl("success", "Onam kaydı oluşturuldu."));
}

async function sendConsentAction(id: string) {
  "use server";
  const session = await requireModuleAccess("consents");
  const consent = await prisma.consent.findFirst({ where: { id, organizationId: session.organizationId, patient: { deletedAt: null } } });
  if (!consent) redirect(resultUrl("error", "Gönderilecek onam bulunamadı."));
  const patient = await prisma.patient.findFirst({ where: { id: consent.patientId, organizationId: session.organizationId, deletedAt: null } });
  if (!patient) redirect(resultUrl("error", "Onam kaydının hastası bulunamadı."));

  let digitalConsent = await prisma.digitalConsent.findFirst({ where: { sourceConsentId: consent.id, organizationId: session.organizationId } });
  if (!digitalConsent) {
    digitalConsent = await prisma.digitalConsent.create({
      data: {
        organizationId: session.organizationId,
        branchId: consent.branchId,
        patientId: patient.id,
        templateId: `consent:${consent.id}`,
        title: consent.templateName,
        contentSnapshot: consent.content,
        language: "TR",
        publicToken: randomUUID(),
        status: DigitalConsentStatus.DRAFT,
        sourceConsentId: consent.id
      }
    });
  }

  const link = new URL(`/consent/${digitalConsent.publicToken}`, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").toString();
  try {
    await sendMessage({
      organizationId: session.organizationId,
      branchId: consent.branchId,
      patientId: patient.id,
      to: patient.phone,
      message: `Merhaba ${patient.firstName}, ${consent.templateName} onam metnini inceleyip güvenli bağlantıdan onaylayabilirsiniz: ${link}`,
      channel: CommunicationChannel.WHATSAPP,
      subject: consent.templateName
    });
  } catch (error) {
    redirect(resultUrl("error", publicErrorMessage(error, "Onam bağlantısı gönderilemedi.")));
  }

  await Promise.all([
    prisma.consent.update({ where: { id: consent.id }, data: { status: ConsentStatus.SENT } }),
    prisma.digitalConsent.update({ where: { id: digitalConsent.id }, data: { status: DigitalConsentStatus.SENT } })
  ]);
  revalidatePath("/dashboard/consents");
  redirect(resultUrl("success", "Tekil onam bağlantısı hastaya teslim edildi."));
}

export default async function ConsentsPage(props: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await requireModuleAccess("consents");
  const locale = await getLocale();
  const [patients, consents] = await Promise.all([
    prisma.patient.findMany({ where: { organizationId: session.organizationId, deletedAt: null }, orderBy: { firstName: "asc" }, take: 200 }),
    prisma.consent.findMany({ where: { organizationId: session.organizationId, patient: { deletedAt: null } }, include: { patient: true }, orderBy: { createdAt: "desc" }, take: 100 })
  ]);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={ClipboardCheck} title="Dijital Onam" description="Onam metni, tekil güvenli bağlantı, imza zaman damgası ve yazdırılabilir kayıt." />
      <div data-print-hidden="true"><PrintButton label="Onam listesini yazdır" /></div>
      {searchParams.success ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">{searchParams.success}</div>
      ) : null}
      {searchParams.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{searchParams.error}</div>
      ) : null}
      <Card>
        <CardHeader><CardTitle>Onam oluştur</CardTitle></CardHeader>
        <CardContent>
          <form action={createConsentAction} className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2"><Label>Hasta</Label><Select name="patientId" required><option value="">Seçin</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</Select></div>
            <div className="space-y-2"><Label>Şablon</Label><Input name="templateName" placeholder="İmplant Onamı" required /></div>
            <div className="space-y-2"><Label>Durum</Label><Select name="status" defaultValue="DRAFT"><option value="DRAFT">Taslak</option><option value="SENT">Gönderildi</option><option value="SIGNED">İmzalandı</option><option value="CANCELLED">İptal</option></Select></div>
            <div className="space-y-2 lg:col-span-3"><Label>İçerik</Label><Textarea name="content" defaultValue="Hasta işlem, riskler ve alternatif tedavi seçenekleri hakkında bilgilendirildi." /></div>
            <Button className="w-fit lg:col-span-3" type="submit">Onam Kaydet</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Hasta</TableHead><TableHead>Şablon</TableHead><TableHead>Durum</TableHead><TableHead>Zaman damgası</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {consents.map((consent) => (
                <TableRow key={consent.id}>
                  <TableCell>{consent.patient.firstName} {consent.patient.lastName}</TableCell>
                  <TableCell>{consent.templateName}</TableCell>
                  <TableCell><Badge variant={consent.status === "SIGNED" ? "success" : "muted"}>{statusLabel(consent.status, locale)}</Badge></TableCell>
                  <TableCell>{formatDateTime(consent.timestamp, locale)}</TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <form action={sendConsentAction.bind(null, consent.id)}><Button type="submit" variant="outline" size="sm"><Send className="h-4 w-4" />İmza gönder</Button></form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
