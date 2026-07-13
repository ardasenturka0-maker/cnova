import { revalidatePath } from "next/cache";
import { HeartPulse, Send } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { surveySchema } from "@/lib/validations/engagement";

async function createSurveyAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const branchId = await getWritableBranchId(session);
  const payload = surveySchema.parse(Object.fromEntries(formData));
  await prisma.survey.create({ data: { title: payload.title, description: payload.description || null, organizationId: session.organizationId, branchId } });
  revalidatePath("/dashboard/surveys");
}

export default async function SurveysPage() {
  const session = await requireSession();
  const [surveys, responses] = await Promise.all([
    prisma.survey.findMany({ where: { organizationId: session.organizationId }, include: { responses: true }, orderBy: { createdAt: "desc" } }),
    prisma.surveyResponse.findMany({ where: { organizationId: session.organizationId, patient: { deletedAt: null } }, include: { patient: true, survey: true }, orderBy: { createdAt: "desc" }, take: 80 })
  ]);
  const average = responses.length ? responses.reduce((sum, item) => sum + item.score, 0) / responses.length : 0;

  return (
    <div className="space-y-6">
      <ModuleHeader icon={HeartPulse} title="Hasta Memnuniyeti" description="Anket oluşturma, 1-5 puanlama ve düşük skor takip listesi." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Ortalama skor</p><p className="mt-2 text-3xl font-semibold">{average.toFixed(1)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Yanıt</p><p className="mt-2 text-3xl font-semibold">{responses.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Düşük puan</p><p className="mt-2 text-3xl font-semibold">{responses.filter((r) => r.score < 3).length}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Anket oluştur</CardTitle></CardHeader>
        <CardContent>
          <form action={createSurveyAction} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Başlık</Label><Input name="title" required /></div>
            <div className="space-y-2"><Label>Açıklama</Label><Textarea name="description" /></div>
            <Button className="w-fit md:col-span-2" type="submit"><Send className="h-4 w-4" />Anket Kaydet</Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Anketler</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {surveys.map((survey) => <div key={survey.id} className="rounded-md border bg-background p-3 text-sm"><div className="font-medium">{survey.title}</div><div className="text-xs text-muted-foreground">{survey.responses.length} yanıt</div></div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Son yanıtlar</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Hasta</TableHead><TableHead>Anket</TableHead><TableHead>Skor</TableHead><TableHead>Yorum</TableHead></TableRow></TableHeader>
              <TableBody>
                {responses.map((response) => (
                  <TableRow key={response.id}><TableCell>{response.patient.firstName} {response.patient.lastName}</TableCell><TableCell>{response.survey.title}</TableCell><TableCell><Badge variant={response.score < 3 ? "danger" : "success"}>{response.score}/5</Badge></TableCell><TableCell>{response.comment ?? "-"}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
