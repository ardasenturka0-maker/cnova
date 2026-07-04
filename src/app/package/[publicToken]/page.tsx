import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { CheckCircle2, HelpCircle, Plane } from "lucide-react";
import { CommunicationChannel, CommunicationDirection } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { acceptTourismPackage } from "@/lib/services/tourismService";
import { publicQuestionSchema } from "@/lib/validations/tourism";
import { formatCurrency, formatDate } from "@/lib/utils";
import { packageStatusLabel, statusTone } from "@/lib/tourism";

async function acceptAction(token: string) {
  "use server";
  const result = await acceptTourismPackage(token);
  if (!result) redirect(`/package/${token}?error=Paket bulunamadı`);
  revalidatePath(`/package/${token}`);
  redirect(`/package/${token}?success=Paket kabul edildi. Satış ekibi rezervasyon için sizinle iletişime geçecek.`);
}

async function questionAction(formData: FormData) {
  "use server";
  const parsed = publicQuestionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/package/${String(formData.get("token") ?? "")}?error=Soru mesajı geçersiz`);
  const tourismPackage = await prisma.tourismPackage.findFirst({ where: { publicToken: parsed.data.token } });
  if (!tourismPackage) redirect(`/package/${parsed.data.token}?error=Paket bulunamadı`);
  await prisma.leadMessage.create({
    data: {
      organizationId: tourismPackage.organizationId,
      branchId: tourismPackage.branchId,
      leadId: tourismPackage.leadId,
      direction: CommunicationDirection.INBOUND,
      channel: CommunicationChannel.WHATSAPP,
      source: "public-package",
      subject: "Paket sorusu",
      message: parsed.data.message
    }
  });
  redirect(`/package/${parsed.data.token}?success=Sorunuz satış ekibine iletildi.`);
}

export default async function PublicPackagePage({ params, searchParams }: { params: { publicToken: string }; searchParams: { success?: string; error?: string } }) {
  const locale = getLocale();
  const tourismPackage = await prisma.tourismPackage.findFirst({ where: { publicToken: params.publicToken } });
  if (!tourismPackage) notFound();
  const [lead, items] = await Promise.all([
    prisma.lead.findFirst({ where: { id: tourismPackage.leadId, organizationId: tourismPackage.organizationId } }),
    prisma.treatmentPackageItem.findMany({ where: { packageId: tourismPackage.id, organizationId: tourismPackage.organizationId } })
  ]);
  const isTr = locale === "tr";

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between rounded-md border bg-card p-4">
          <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-md bg-primary text-primary-foreground"><Plane className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">ClinicNova Tourism</p><h1 className="text-2xl font-semibold">{tourismPackage.packageTitle}</h1></div></div>
          <Badge variant={statusTone(tourismPackage.packageStatus)}>{packageStatusLabel(tourismPackage.packageStatus, locale)}</Badge>
        </div>
        {searchParams.success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{searchParams.success}</div> : null}
        {searchParams.error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{searchParams.error}</div> : null}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader><CardTitle>{isTr ? "Tedavi Detayları" : "Treatment Details"}</CardTitle><CardDescription>{tourismPackage.treatmentSummary}</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-md border bg-background p-3">
                  <div className="flex justify-between gap-3"><strong>{item.treatmentName}</strong><span>{formatCurrency(item.totalPrice, locale)}</span></div>
                  <p className="text-sm text-muted-foreground">{item.toothArea ?? "-"} · {item.estimatedDuration ?? "-"} · {item.explanation ?? ""}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{isTr ? "Seyahat Paketi" : "Travel Package"}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span>Hotel</span><strong>{tourismPackage.hotelInfo ?? "-"}</strong></div>
              <div className="flex justify-between"><span>Transfer</span><strong>{tourismPackage.transferInfo ?? "-"}</strong></div>
              <div className="flex justify-between"><span>Airport</span><strong>{tourismPackage.arrivalAirport ?? "-"}</strong></div>
              <div className="flex justify-between"><span>Arrival</span><strong>{tourismPackage.arrivalDate ? formatDate(tourismPackage.arrivalDate, locale) : "-"}</strong></div>
              <div className="flex justify-between"><span>Departure</span><strong>{tourismPackage.departureDate ? formatDate(tourismPackage.departureDate, locale) : "-"}</strong></div>
              <div className="flex justify-between"><span>Companions</span><strong>{tourismPackage.numberOfCompanions}</strong></div>
              <div className="border-t pt-3">
                <div className="flex justify-between"><span>Treatment</span><strong>{formatCurrency(tourismPackage.totalTreatmentPrice, locale)}</strong></div>
                <div className="flex justify-between"><span>Hotel</span><strong>{formatCurrency(tourismPackage.hotelPrice, locale)}</strong></div>
                <div className="flex justify-between"><span>Transfer</span><strong>{formatCurrency(tourismPackage.transferPrice, locale)}</strong></div>
                <div className="flex justify-between"><span>Discount</span><strong>-{formatCurrency(tourismPackage.discount, locale)}</strong></div>
                <div className="mt-2 flex justify-between text-lg"><span>Total</span><strong>{formatCurrency(tourismPackage.finalPrice, locale)}</strong></div>
              </div>
              <p className="text-xs text-muted-foreground">Valid until {tourismPackage.validUntil ? formatDate(tourismPackage.validUntil, locale) : "-"}</p>
              <form action={acceptAction.bind(null, params.publicToken)}><Button className="w-full" type="submit"><CheckCircle2 className="h-4 w-4" />{isTr ? "Paketi Kabul Ediyorum" : "I Accept This Package"}</Button></form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle><HelpCircle className="inline h-5 w-5" /> {isTr ? "Sorularım var" : "I have questions"}</CardTitle></CardHeader>
          <CardContent>
            <form action={questionAction} className="space-y-3">
              <input type="hidden" name="token" value={params.publicToken} />
              <Textarea name="message" placeholder={isTr ? "Sorunuzu yazın" : "Write your question"} required />
              <Button variant="outline" type="submit">{isTr ? "Satış Ekibine Gönder" : "Send to Sales Team"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
