import { redirect, notFound } from "next/navigation";
import { FileSignature } from "lucide-react";
import { DigitalConsentStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/services/auditLogService";
import { digitalConsentSignSchema } from "@/lib/validations/tourism";
import { formatDateTime } from "@/lib/utils";

async function signConsentAction(formData: FormData) {
  "use server";
  const parsed = digitalConsentSignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !parsed.data.understood) redirect(`/consent/${String(formData.get("token") ?? "")}?error=Lütfen metni okuduğunuzu onaylayın.`);
  const consent = await prisma.digitalConsent.findFirst({ where: { publicToken: parsed.data.token } });
  if (!consent) redirect(`/consent/${parsed.data.token}?error=Onam bulunamadı.`);
  await prisma.digitalConsent.update({
    where: { id: consent.id },
    data: {
      status: DigitalConsentStatus.SIGNED,
      signedAt: new Date(),
      signerName: parsed.data.signerName,
      signerIp: "127.0.0.1",
      signerUserAgent: "Mock Browser",
      signatureData: parsed.data.signatureData
    }
  });
  await writeAuditLog({ action: "SIGN_DIGITAL_CONSENT", module: "tourism-consents", entityId: consent.id, metadata: { signerName: parsed.data.signerName }, organizationId: consent.organizationId, branchId: consent.branchId });
  redirect(`/consent/${parsed.data.token}?success=Onam imzalandı. Demo zaman damgası oluşturuldu.`);
}

export default async function ConsentPage({ params, searchParams }: { params: { token: string }; searchParams: { success?: string; error?: string } }) {
  const locale = getLocale();
  const consent = await prisma.digitalConsent.findFirst({ where: { publicToken: params.token } });
  if (!consent) notFound();

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <div className="grid h-12 w-12 place-items-center rounded-md bg-primary/10 text-primary"><FileSignature className="h-5 w-5" /></div>
            <CardTitle>{consent.title}</CardTitle>
            <CardDescription>Demo dijital onam. Gerçek hukuki e-imza entegrasyonu sonradan eklenebilir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {searchParams.success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{searchParams.success}</div> : null}
            {searchParams.error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{searchParams.error}</div> : null}
            <div className="rounded-md border bg-background p-4 text-sm leading-7">{consent.contentSnapshot}</div>
            {consent.signedAt ? <div className="rounded-md border bg-muted p-3 text-sm">İmzalandı: {formatDateTime(consent.signedAt, locale)} · {consent.signerName}</div> : null}
            <form action={signConsentAction} className="space-y-4">
              <input type="hidden" name="token" value={params.token} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="understood" value="true" /> Bilgilendirme metnini okudum ve anladım</label>
              <div className="space-y-2"><Label>Ad Soyad</Label><Input name="signerName" defaultValue={consent.signerName ?? ""} required /></div>
              <div className="space-y-2"><Label>Basit imza</Label><Textarea name="signatureData" placeholder="Adınızı tekrar yazarak imzalayın" required /></div>
              <Button type="submit">Onaylıyorum</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
