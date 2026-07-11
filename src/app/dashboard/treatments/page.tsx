import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Stethoscope } from "lucide-react";
import { Role, TreatmentStatus } from "@prisma/client";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { TreatmentStatusBadge } from "@/components/dashboard/treatment-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { buildPaymentPlan, paymentPlanLines, summarizePaymentPlan } from "@/lib/payment-plan";
import { prisma } from "@/lib/prisma";
import { treatmentSchema } from "@/lib/validations/treatment";
import { formatCurrency, formatDate } from "@/lib/utils";

function resultUrl(type: "success" | "error", message: string) {
  return `/dashboard/treatments?${type}=${encodeURIComponent(message)}`;
}

async function createTreatmentAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const parsed = treatmentSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect(resultUrl("error", parsed.error.issues[0]?.message ?? "Tedavi formu geçersiz."));
  }

  const payload = parsed.data;
  const patient = await prisma.patient.findFirst({ where: { id: payload.patientId, organizationId: session.organizationId }, select: { branchId: true } });

  if (!patient) {
    redirect(resultUrl("error", "Seçilen hasta bulunamadı veya bu kliniğe ait değil."));
  }

  const doctor = await prisma.user.findFirst({ where: { id: payload.doctorId, organizationId: session.organizationId, active: true }, select: { id: true } });

  if (!doctor) {
    redirect(resultUrl("error", "Seçilen doktor bulunamadı veya aktif değil."));
  }

  try {
    const paymentPlan = buildPaymentPlan({
      total: payload.fee,
      downPayment: payload.downPayment,
      installmentCount: payload.installmentCount,
      firstInstallmentDate: payload.firstInstallmentDate || null,
      note: payload.paymentPlanNote || null
    });

    await prisma.treatment.create({
      data: {
        patientId: payload.patientId,
        doctorId: payload.doctorId,
        toothNumber: payload.toothNumber || null,
        treatmentType: payload.treatmentType,
        description: payload.description || null,
        fee: payload.fee,
        paymentPlan,
        status: payload.status as TreatmentStatus,
        performedAt: payload.date ? new Date(payload.date) : new Date(),
        organizationId: session.organizationId,
        branchId: patient.branchId
      }
    });
  } catch {
    redirect(resultUrl("error", "Tedavi kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin."));
  }

  revalidatePath("/dashboard/treatments");
  redirect(resultUrl("success", "Tedavi kaydı oluşturuldu."));
}

export default async function TreatmentsPage(props: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const [treatments, patients, doctors] = await Promise.all([
    prisma.treatment.findMany({
      where: { organizationId: session.organizationId },
      include: { patient: true, doctor: { select: { name: true } }, branch: { select: { name: true } } },
      orderBy: { performedAt: "desc" },
      take: 100
    }),
    prisma.patient.findMany({ where: { organizationId: session.organizationId }, orderBy: { firstName: "asc" }, take: 200 }),
    prisma.user.findMany({ where: { organizationId: session.organizationId, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] } }, orderBy: { name: "asc" } })
  ]);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Stethoscope} title="Tedavi Modülü" description="Gerçekleşen tedaviler, ücretler, diş numarası ve hekim kayıtları." actionHref="/dashboard/treatment-plans" actionLabel="Tedavi Planları" />
      {searchParams.success ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">{searchParams.success}</div>
      ) : null}
      {searchParams.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{searchParams.error}</div>
      ) : null}
      <Card>
        <CardHeader><CardTitle>Tedavi ekle</CardTitle></CardHeader>
        <CardContent>
          <form action={createTreatmentAction} className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-2"><Label>Hasta</Label><Select name="patientId" required><option value="">Seçin</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</Select></div>
            <div className="space-y-2"><Label>Doktor</Label><Select name="doctorId" required><option value="">Seçin</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></div>
            <div className="space-y-2"><Label>Diş no</Label><Input name="toothNumber" /></div>
            <div className="space-y-2"><Label>Tedavi türü</Label><Input name="treatmentType" placeholder="Dolgu" required /></div>
            <div className="space-y-2"><Label>Ücret</Label><Input name="fee" type="number" min="0" step="0.01" defaultValue="0" /></div>
            <div className="space-y-2"><Label>Durum</Label><Select name="status" defaultValue="STARTED"><option value="PROPOSED">Önerildi</option><option value="ACCEPTED">Kabul edildi</option><option value="STARTED">Başladı</option><option value="COMPLETED">Tamamlandı</option><option value="CANCELLED">İptal</option></Select></div>
            <div className="space-y-2"><Label>Tarih</Label><Input name="date" type="date" /></div>
            <div className="space-y-2"><Label>Peşinat</Label><Input name="downPayment" type="number" min="0" step="0.01" defaultValue="0" /></div>
            <div className="space-y-2"><Label>Taksit sayısı</Label><Select name="installmentCount" defaultValue="1"><option value="1">Tek ödeme</option><option value="2">2 taksit</option><option value="3">3 taksit</option><option value="4">4 taksit</option><option value="6">6 taksit</option><option value="9">9 taksit</option><option value="12">12 taksit</option><option value="18">18 taksit</option><option value="24">24 taksit</option></Select></div>
            <div className="space-y-2"><Label>İlk ödeme tarihi</Label><Input name="firstInstallmentDate" type="date" /></div>
            <div className="space-y-2 lg:col-span-4"><Label>Açıklama</Label><Textarea name="description" /></div>
            <div className="space-y-2 lg:col-span-4"><Label>Tahsilat planı notu</Label><Textarea name="paymentPlanNote" placeholder="Örn. İlk taksit işlem günü kartla, kalanlar aylık link ile alınacak." /></div>
            <Button className="w-fit lg:col-span-4" type="submit">Tedavi Kaydet</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Hasta</TableHead><TableHead>Doktor</TableHead><TableHead>Tedavi</TableHead><TableHead>Ücret</TableHead><TableHead>Tahsilat planı</TableHead><TableHead>Durum</TableHead></TableRow></TableHeader>
            <TableBody>
              {treatments.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDate(item.performedAt, locale)}</TableCell>
                  <TableCell>{item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : "Hasta bulunamadı"}</TableCell>
                  <TableCell>{item.doctor?.name ?? "Doktor bulunamadı"}</TableCell>
                  <TableCell>{item.treatmentType} {item.toothNumber ? `#${item.toothNumber}` : ""}</TableCell>
                  <TableCell>{formatCurrency(item.fee, locale)}</TableCell>
                  <TableCell>
                    <details className="max-w-xs">
                      <summary className="cursor-pointer list-none text-sm font-medium text-primary">{summarizePaymentPlan(item.paymentPlan)}</summary>
                      <div className="mt-2 space-y-1 rounded-md border bg-background p-2 text-xs text-muted-foreground">
                        {paymentPlanLines(item.paymentPlan).map((line) => <div key={line}>{line}</div>)}
                      </div>
                    </details>
                  </TableCell>
                  <TableCell><TreatmentStatusBadge status={item.status} locale={locale} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
