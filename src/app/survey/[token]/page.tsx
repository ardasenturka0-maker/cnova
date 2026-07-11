import { redirect, notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { TourismSurveySource } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { tourismSurveySubmitSchema } from "@/lib/validations/tourism";

async function submitSurveyAction(formData: FormData) {
  "use server";
  const parsed = tourismSurveySubmitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/survey/${String(formData.get("token") ?? "")}?error=Anket formu geçersiz`);
  const tourismPackage = await prisma.tourismPackage.findFirst({ where: { publicToken: parsed.data.token } });
  if (!tourismPackage?.patientId) redirect(`/survey/${parsed.data.token}?error=Hasta kaydı bulunamadı`);
  const [survey, template] = await Promise.all([
    prisma.survey.findFirst({ where: { organizationId: tourismPackage.organizationId } }),
    prisma.surveyTemplate.findFirst({ where: { organizationId: tourismPackage.organizationId, active: true } })
  ]);
  if (!survey) redirect(`/survey/${parsed.data.token}?error=Anket şablonu bulunamadı`);
  await prisma.surveyResponse.create({
    data: {
      organizationId: tourismPackage.organizationId,
      branchId: tourismPackage.branchId ?? "",
      surveyId: survey.id,
      patientId: tourismPackage.patientId,
      packageId: tourismPackage.id,
      surveyTemplateId: template?.id ?? null,
      score: parsed.data.rating,
      rating: parsed.data.rating,
      answersJson: { doctor: parsed.data.doctor, clinic: parsed.data.clinic, transfer: parsed.data.transfer, hotel: parsed.data.hotel, turkey: parsed.data.turkey },
      npsScore: parsed.data.npsScore,
      comment: parsed.data.comment || null,
      source: TourismSurveySource.WEB_LINK,
      submittedAt: new Date(),
      followUpNeeded: parsed.data.rating < 3 || parsed.data.npsScore < 7
    }
  });
  redirect(`/survey/${parsed.data.token}?success=Teşekkürler, cevabınız kaydedildi.`);
}

export default async function SurveyPage(
  props: { params: Promise<{ token: string }>; searchParams: Promise<{ success?: string; error?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const tourismPackage = await prisma.tourismPackage.findFirst({ where: { publicToken: params.token } });
  if (!tourismPackage) notFound();

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <div className="grid h-12 w-12 place-items-center rounded-md bg-primary/10 text-primary"><MessageCircle className="h-5 w-5" /></div>
            <CardTitle>Memnuniyet Anketi</CardTitle>
            <CardDescription>{tourismPackage.packageTitle} deneyiminizi değerlendirin.</CardDescription>
          </CardHeader>
          <CardContent>
            {searchParams.success ? <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{searchParams.success}</div> : null}
            {searchParams.error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{searchParams.error}</div> : null}
            <form action={submitSurveyAction} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="token" value={params.token} />
              <div className="space-y-2"><Label>Genel memnuniyet 1-5</Label><Input name="rating" type="number" min={1} max={5} defaultValue={5} /></div>
              <div className="space-y-2"><Label>Doktor ilgisi 1-5</Label><Input name="doctor" type="number" min={1} max={5} defaultValue={5} /></div>
              <div className="space-y-2"><Label>Klinik temizliği 1-5</Label><Input name="clinic" type="number" min={1} max={5} defaultValue={5} /></div>
              <div className="space-y-2"><Label>Transfer 1-5</Label><Input name="transfer" type="number" min={1} max={5} defaultValue={5} /></div>
              <div className="space-y-2"><Label>Otel 1-5</Label><Input name="hotel" type="number" min={1} max={5} defaultValue={5} /></div>
              <div className="space-y-2"><Label>Türkiye deneyimi 1-5</Label><Input name="turkey" type="number" min={1} max={5} defaultValue={5} /></div>
              <div className="space-y-2"><Label>NPS 0-10</Label><Input name="npsScore" type="number" min={0} max={10} defaultValue={10} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Yorum</Label><Textarea name="comment" placeholder="Deneyiminizi yazın" /></div>
              <Button className="w-fit md:col-span-2" type="submit">Anketi Gönder</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
