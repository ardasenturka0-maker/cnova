import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Stethoscope } from "lucide-react";
import { Role, TreatmentStatus } from "@prisma/client";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { TreatmentStatusBadge } from "@/components/dashboard/treatment-status-badge";
import { PatientDoctorFields } from "@/components/dashboard/patient-doctor-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireModuleAccess } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { buildPaymentPlan, paymentPlanLines, summarizePaymentPlan } from "@/lib/payment-plan";
import { prisma } from "@/lib/prisma";
import { publicErrorMessage } from "@/lib/public-error";
import { consumeTreatmentRecipe, setTreatmentStatus } from "@/lib/services/treatmentStockService";
import { treatmentSchema } from "@/lib/validations/treatment";
import { formatCurrency, formatDate } from "@/lib/utils";

function resultUrl(type: "success" | "error", message: string) {
  return `/dashboard/treatments?${type}=${encodeURIComponent(message)}`;
}

async function createTreatmentAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("treatments");
  const parsed = treatmentSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect(resultUrl("error", parsed.error.issues[0]?.message ?? "Tedavi formu geçersiz."));
  }

  const payload = parsed.data;
  const patient = await prisma.patient.findFirst({ where: { id: payload.patientId, organizationId: session.organizationId, deletedAt: null }, select: { branchId: true } });

  if (!patient) {
    redirect(resultUrl("error", "Seçilen hasta bulunamadı veya bu kliniğe ait değil."));
  }

  const doctor = await prisma.user.findFirst({
    where: {
      id: payload.doctorId,
      organizationId: session.organizationId,
      active: true,
      role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] },
      OR: [{ branchId: patient.branchId }, { branchId: null }]
    },
    select: { id: true }
  });

  if (!doctor) {
    redirect(resultUrl("error", "Seçilen doktor aktif değil veya hastanın şubesinde çalışmıyor."));
  }

  try {
    const paymentPlan = buildPaymentPlan({
      total: payload.fee,
      downPayment: payload.downPayment,
      installmentCount: payload.installmentCount,
      firstInstallmentDate: payload.firstInstallmentDate || null,
      note: payload.paymentPlanNote || null
    });

    await prisma.$transaction(async (tx) => {
      const treatment = await tx.treatment.create({ data: {
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
      } });
      if (treatment.status === TreatmentStatus.COMPLETED) {
        await consumeTreatmentRecipe(tx, session.organizationId, patient.branchId, treatment.treatmentType, { treatmentId: treatment.id });
      }
      return treatment;
    });
  } catch (error) {
    redirect(resultUrl("error", publicErrorMessage(error, "Tedavi kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.")));
  }

  revalidatePath("/dashboard/treatments");
  redirect(resultUrl("success", "Tedavi kaydı oluşturuldu."));
}

async function updateTreatmentStatusAction(treatmentId: string, formData: FormData) {
  "use server";
  const session = await requireModuleAccess("treatments");
  const status = formData.get("status");
  if (typeof status !== "string" || !Object.values(TreatmentStatus).includes(status as TreatmentStatus)) {
    redirect(resultUrl("error", "Tedavi durumu geçersiz."));
  }
  try {
    await setTreatmentStatus(session.organizationId, treatmentId, status as TreatmentStatus);
  } catch (error) {
    redirect(resultUrl("error", publicErrorMessage(error, "Tedavi durumu güncellenemedi.")));
  }
  revalidatePath("/dashboard/treatments");
  revalidatePath("/dashboard/stocks");
  redirect(resultUrl("success", status === TreatmentStatus.COMPLETED ? "Tedavi tamamlandı; reçetedeki malzemeler stoktan otomatik düşüldü." : "Tedavi durumu güncellendi; gerekiyorsa stok iadesi işlendi."));
}

export default async function TreatmentsPage(props: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await requireModuleAccess("treatments");
  const locale = await getLocale();
  const [treatments, patients, doctors] = await Promise.all([
    prisma.treatment.findMany({
      where: { organizationId: session.organizationId, patient: { deletedAt: null } },
      include: { patient: true, doctor: { select: { name: true } }, branch: { select: { name: true } } },
      orderBy: { performedAt: "desc" },
      take: 100
    }),
    prisma.patient.findMany({ where: { organizationId: session.organizationId, deletedAt: null }, select: { id: true, firstName: true, lastName: true, branchId: true }, orderBy: { firstName: "asc" }, take: 200 }),
    prisma.user.findMany({ where: { organizationId: session.organizationId, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, active: true }, select: { id: true, name: true, branchId: true }, orderBy: { name: "asc" } })
  ]);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Stethoscope} title="Tedavi Modülü" description="Gerçekleşen tedaviler, ücretler, hekim kayıtları ve tamamlanınca otomatik malzeme sarfı." actionHref="/dashboard/treatment-plans" actionLabel="Tedavi Planları" />
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
            <PatientDoctorFields patients={patients} doctors={doctors} />
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
            <TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Hasta</TableHead><TableHead>Doktor</TableHead><TableHead>Tedavi</TableHead><TableHead>Ücret</TableHead><TableHead>Tahsilat planı</TableHead><TableHead>Durum / stok</TableHead></TableRow></TableHeader>
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
                  <TableCell>
                    <form action={updateTreatmentStatusAction.bind(null, item.id)} className="flex min-w-44 items-center gap-2">
                      <Select name="status" defaultValue={item.status} aria-label={`${item.treatmentType} durumu`}>
                        <option value="PROPOSED">Önerildi</option><option value="ACCEPTED">Kabul edildi</option><option value="STARTED">Başladı</option><option value="COMPLETED">Tamamlandı</option><option value="CANCELLED">İptal</option>
                      </Select>
                      <Button type="submit" size="sm" variant="outline">Kaydet</Button>
                    </form>
                    <div className="mt-2"><TreatmentStatusBadge status={item.status} locale={locale} /></div>
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
