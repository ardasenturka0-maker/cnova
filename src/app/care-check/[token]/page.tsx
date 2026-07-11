import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { NotificationType, PostTreatmentFollowUpStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { careCheckSchema } from "@/lib/validations/tourism";

async function submitCareCheckAction(formData: FormData) {
  "use server";
  const parsed = careCheckSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/care-check/${String(formData.get("token") ?? "")}?error=Form geçersiz`);
  const followUp = await prisma.postTreatmentFollowUp.findFirst({ where: { publicToken: parsed.data.token } });
  if (!followUp) redirect(`/care-check/${parsed.data.token}?error=Kayıt bulunamadı`);
  const issue = parsed.data.status === "ISSUE";
  await prisma.postTreatmentFollowUp.update({
    where: { id: followUp.id },
    data: {
      status: issue ? PostTreatmentFollowUpStatus.ISSUE_REPORTED : PostTreatmentFollowUpStatus.REPLIED,
      issueReported: issue,
      issueDescription: issue ? parsed.data.issueDescription || "Açıklama girilmedi" : null,
      painLevel: issue ? parsed.data.painLevel : null
    }
  });
  if (issue) {
    await prisma.notification.create({ data: { organizationId: followUp.organizationId, title: "Tedavi sonrası sorun bildirildi", message: parsed.data.issueDescription || "Hasta sorun bildirdi.", type: NotificationType.ISSUE, actionUrl: "/dashboard/tourism/post-treatment" } });
    await prisma.task.create({ data: { organizationId: followUp.organizationId, branchId: followUp.branchId, relatedPatientId: followUp.patientId, title: "Tedavi sonrası sorun kontrolü", description: parsed.data.issueDescription, priority: TaskPriority.URGENT, status: TaskStatus.TODO, dueDate: new Date() } });
  }
  revalidatePath("/dashboard/tourism/post-treatment");
  redirect(`/care-check/${parsed.data.token}?success=${issue ? "Sorun bildiriminiz ekibe iletildi." : "Teşekkürler, kaydınız alındı."}`);
}

export default async function CareCheckPage(
  props: { params: Promise<{ token: string }>; searchParams: Promise<{ success?: string; error?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const followUp = await prisma.postTreatmentFollowUp.findFirst({ where: { publicToken: params.token } });
  if (!followUp) notFound();
  const patient = await prisma.patient.findFirst({ where: { id: followUp.patientId, organizationId: followUp.organizationId } });

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <div className="grid h-12 w-12 place-items-center rounded-md bg-primary/10 text-primary"><HeartPulse className="h-5 w-5" /></div>
            <CardTitle>Tedavi Sonrası Kontrol</CardTitle>
            <CardDescription>{patient ? `${patient.firstName} ${patient.lastName}, ` : ""}tedavinizden sonra nasıl hissediyorsunuz?</CardDescription>
          </CardHeader>
          <CardContent>
            {searchParams.success ? <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{searchParams.success}</div> : null}
            {searchParams.error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{searchParams.error}</div> : null}
            <form action={submitCareCheckAction} className="space-y-4">
              <input type="hidden" name="token" value={params.token} />
              <div className="space-y-2"><Label>Durum</Label><Select name="status" defaultValue="OK"><option value="OK">Her şey yolunda</option><option value="ISSUE">Bir sorun yaşıyorum</option></Select></div>
              <div className="space-y-2"><Label>Ağrı seviyesi 0-10</Label><Input name="painLevel" type="number" min={0} max={10} defaultValue={0} /></div>
              <div className="space-y-2"><Label>Açıklama</Label><Textarea name="issueDescription" placeholder="Ağrı, hassasiyet, şişlik veya başka bir sorununuzu yazın" /></div>
              <div className="space-y-2"><Label>İletişim tercihi</Label><Input name="contactPreference" placeholder="WhatsApp / Telefon / E-posta" /></div>
              <Button type="submit">Kontrol Formunu Gönder</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
