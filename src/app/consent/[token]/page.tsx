import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { FileSignature } from "lucide-react";
import { DigitalConsentStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { redirectWithMessage } from "@/lib/redirect-url";
import { allowServerAction } from "@/lib/server-action-rate-limit";
import { digitalConsentSignSchema } from "@/lib/validations/digital-consent";
import { formatDateTime } from "@/lib/utils";

async function signConsentAction(formData: FormData) {
  "use server";
  const parsed = digitalConsentSignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !parsed.data.understood) redirect(redirectWithMessage(`/consent/${String(formData.get("token") ?? "")}`, "error", "Lütfen metni okuduğunuzu onaylayın."));
  if (!await allowServerAction(`consent:${parsed.data.token}`, 10, 60 * 60 * 1000)) redirect(redirectWithMessage(`/consent/${parsed.data.token}`, "error", "Çok fazla deneme. Lütfen daha sonra tekrar deneyin."));
  const consent = await prisma.digitalConsent.findFirst({ where: { publicToken: parsed.data.token } });
  if (!consent) redirect(redirectWithMessage(`/consent/${parsed.data.token}`, "error", "Onam bulunamadı."));
  if (consent.status === DigitalConsentStatus.SIGNED || consent.status === DigitalConsentStatus.DECLINED || consent.status === DigitalConsentStatus.EXPIRED) {
    redirect(redirectWithMessage(`/consent/${parsed.data.token}`, "error", "Bu onam bağlantısı artık imzaya açık değil."));
  }
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const signerIp = forwardedFor ?? requestHeaders.get("x-real-ip") ?? "unknown";
  const signerUserAgent = requestHeaders.get("user-agent")?.slice(0, 500) ?? "unknown";
  const signedAt = new Date();
  const signed = await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.digitalConsent.updateMany({
      where: {
        id: consent.id,
        signedAt: null,
        status: { in: [DigitalConsentStatus.DRAFT, DigitalConsentStatus.SENT, DigitalConsentStatus.VIEWED] }
      },
      data: {
        status: DigitalConsentStatus.SIGNED,
        signedAt,
        signerName: parsed.data.signerName,
        signerIp,
        signerUserAgent,
        signatureData: parsed.data.signatureData
      }
    });
    if (claimed.count !== 1) return false;
    if (consent.sourceConsentId) {
      await transaction.consent.updateMany({
        where: { id: consent.sourceConsentId, organizationId: consent.organizationId },
        data: { status: "SIGNED", signedAt }
      });
    }
    await transaction.auditLog.create({
      data: {
        action: "SIGN_DIGITAL_CONSENT",
        module: "consents",
        entityId: consent.id,
        metadata: { signerName: parsed.data.signerName },
        organizationId: consent.organizationId,
        branchId: consent.branchId
      }
    });
    return true;
  });
  if (!signed) {
    redirect(redirectWithMessage(`/consent/${parsed.data.token}`, "error", "Bu onam başka bir oturumda zaten tamamlandı veya artık imzaya açık değil."));
  }
  redirect(redirectWithMessage(`/consent/${parsed.data.token}`, "success", "Onam imzalandı ve zaman damgası kaydedildi."));
}

export default async function ConsentPage(
  props: { params: Promise<{ token: string }>; searchParams: Promise<{ success?: string; error?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const locale = await getLocale();
  const consent = await prisma.digitalConsent.findFirst({ where: { publicToken: params.token } });
  if (!consent) notFound();

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <div className="grid h-12 w-12 place-items-center rounded-md bg-primary/10 text-primary"><FileSignature className="h-5 w-5" /></div>
            <CardTitle>{consent.title}</CardTitle>
            <CardDescription>Tekil bağlantı, imzalayan bilgisi ve zaman damgasıyla kaydedilen elektronik onam.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {searchParams.success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{searchParams.success}</div> : null}
            {searchParams.error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{searchParams.error}</div> : null}
            <div className="rounded-md border bg-background p-4 text-sm leading-7">{consent.contentSnapshot}</div>
            {consent.signedAt ? <div className="rounded-md border bg-muted p-3 text-sm">İmzalandı: {formatDateTime(consent.signedAt, locale)} · {consent.signerName}</div> : null}
            {!consent.signedAt && ([DigitalConsentStatus.DRAFT, DigitalConsentStatus.SENT, DigitalConsentStatus.VIEWED] as DigitalConsentStatus[]).includes(consent.status) ? <form action={signConsentAction} className="space-y-4">
              <input type="hidden" name="token" value={params.token} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="understood" value="true" /> Bilgilendirme metnini okudum ve anladım</label>
              <div className="space-y-2"><Label>Ad Soyad</Label><Input name="signerName" defaultValue={consent.signerName ?? ""} required /></div>
              <div className="space-y-2"><Label>Basit imza</Label><Textarea name="signatureData" placeholder="Adınızı tekrar yazarak imzalayın" required /></div>
              <Button type="submit">Onaylıyorum</Button>
            </form> : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
