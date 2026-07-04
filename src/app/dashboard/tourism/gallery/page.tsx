import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { GalleryHorizontalEnd, Sparkles, Upload } from "lucide-react";
import { BeforeAfterStatus } from "@prisma/client";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { gdprNotice, statusTone } from "@/lib/tourism";

function resultUrl(message: string) {
  return `/dashboard/tourism/gallery?success=${encodeURIComponent(message)}`;
}

async function publishCaseAction(id: string) {
  "use server";
  const session = await requireSession();
  const beforeAfterCase = await prisma.beforeAfterCase.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!beforeAfterCase || !beforeAfterCase.consentGiven) redirect(resultUrl("Onay olmayan vaka yayınlanamaz."));
  await prisma.beforeAfterCase.update({ where: { id }, data: { status: BeforeAfterStatus.PUBLISHED_WEBSITE } });
  revalidatePath("/dashboard/tourism/gallery");
  redirect(resultUrl("Vaka web sitesi yayınına mock olarak hazırlandı."));
}

async function createCaseAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const patients = await prisma.patient.findMany({ where: { organizationId: session.organizationId }, take: 1 });
  const patient = patients[0];
  if (!patient) redirect(resultUrl("Önce hasta kaydı gerekli."));
  await prisma.beforeAfterCase.create({
    data: {
      organizationId: session.organizationId,
      branchId: patient.branchId,
      patientId: patient.id,
      treatmentType: String(formData.get("treatmentType") ?? "Smile Design"),
      title: String(formData.get("title") ?? "Yeni vaka"),
      description: String(formData.get("description") ?? "") || null,
      beforeImageUrl: String(formData.get("beforeImageUrl") ?? "https://placehold.co/640x420?text=Before"),
      afterImageUrl: String(formData.get("afterImageUrl") ?? "https://placehold.co/640x420?text=After"),
      consentGiven: formData.get("consentGiven") === "true",
      country: String(formData.get("country") ?? "United Kingdom"),
      ageRange: String(formData.get("ageRange") ?? "35-44"),
      tags: String(formData.get("tags") ?? "smile-design").split(",").map((item) => item.trim()),
      privacyNotes: String(formData.get("privacyNotes") ?? gdprNotice),
      status: BeforeAfterStatus.DRAFT
    }
  });
  revalidatePath("/dashboard/tourism/gallery");
  redirect(resultUrl("Önce/sonra vakası eklendi."));
}

export default async function GalleryPage({ searchParams }: { searchParams: { success?: string; treatment?: string } }) {
  const session = await requireSession();
  const locale = getLocale();
  const cases = await prisma.beforeAfterCase.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 100 });
  const treatments = [...new Set(cases.map((item) => item.treatmentType))];
  const filtered = searchParams.treatment ? cases.filter((item) => item.treatmentType === searchParams.treatment) : cases;

  return (
    <div className="space-y-6">
      <ModuleHeader icon={GalleryHorizontalEnd} title="Önce/Sonra Galerisi" description="Onaylı vaka fotoğraflarını tedavi türüne göre yayın ve sosyal medya için hazırla." />
      {searchParams.success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{searchParams.success}</div> : null}
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{gdprNotice}</div>

      <Card>
        <CardHeader><CardTitle>Yeni Vaka Ekle</CardTitle></CardHeader>
        <CardContent>
          <form action={createCaseAction} className="grid gap-4 md:grid-cols-3">
            <Input name="title" placeholder="Vaka başlığı" required />
            <Select name="treatmentType" defaultValue="Hollywood Smile"><option>Dental Implant</option><option>Hollywood Smile</option><option>Veneers</option><option>Teeth Whitening</option><option>Zirconium Crown</option></Select>
            <Input name="country" defaultValue="United Kingdom" />
            <Input name="beforeImageUrl" defaultValue="https://placehold.co/640x420?text=Before" />
            <Input name="afterImageUrl" defaultValue="https://placehold.co/640x420?text=After" />
            <Input name="ageRange" defaultValue="35-44" />
            <Input name="tags" defaultValue="smile-design, tourism" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="consentGiven" value="true" /> Hasta yayın onayı var</label>
            <Textarea name="privacyNotes" defaultValue="Yüz görünürlüğü ve KVKK/GDPR izni kontrol edildi." />
            <Textarea name="description" className="md:col-span-3" placeholder="Vaka açıklaması" />
            <Button className="w-fit md:col-span-3" type="submit"><Upload className="h-4 w-4" />Vaka Ekle</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <form className="flex flex-wrap gap-3">
            <Select name="treatment" defaultValue={searchParams.treatment ?? ""}><option value="">Tüm tedaviler</option>{treatments.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
            <Button variant="outline" type="submit">Filtrele</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div><CardTitle>{item.title}</CardTitle><CardDescription>{item.treatmentType} · {item.country ?? "-"}</CardDescription></div>
                <Badge variant={statusTone(item.status)}>{statusLabel(item.status, locale)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="aspect-[4/3] rounded-md border bg-muted p-3 text-sm text-muted-foreground">Before<br />{item.beforeImageUrl}</div>
                <div className="aspect-[4/3] rounded-md border bg-muted p-3 text-sm text-muted-foreground">After<br />{item.afterImageUrl}</div>
              </div>
              <p className="text-sm text-muted-foreground">{item.description}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant={item.consentGiven ? "success" : "danger"}>{item.consentGiven ? "Onay var" : "Onay yok"}</Badge>
                <Badge variant="default">{item.ageRange ?? "-"}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm"><Sparkles className="h-4 w-4" />AI Açıklama Mock</Button>
                <form action={publishCaseAction.bind(null, item.id)}><Button size="sm" disabled={!item.consentGiven}>Web’de Yayınla</Button></form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
