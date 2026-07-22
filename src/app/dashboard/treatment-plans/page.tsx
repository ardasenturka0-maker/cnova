import { revalidatePath } from "next/cache";
import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PaymentMethod, PaymentStatus, PaymentType, Role, TreatmentStatus } from "@prisma/client";
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
import { buildPaymentPlan, summarizePaymentPlan } from "@/lib/payment-plan";
import { prisma } from "@/lib/prisma";
import { treatmentPlanSchema } from "@/lib/validations/treatment";
import { formatCurrency, formatDate } from "@/lib/utils";

function resultUrl(type: "success" | "error", message: string) {
  return `/dashboard/treatment-plans?${type}=${encodeURIComponent(message)}`;
}

async function createPlanAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("treatments");
  const parsed = treatmentPlanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(resultUrl("error", parsed.error.issues[0]?.message ?? "Tedavi planı formu geçersiz."));
  const payload = parsed.data;
  const patient = await prisma.patient.findFirst({ where: { id: payload.patientId, organizationId: session.organizationId, deletedAt: null }, select: { branchId: true } });
  if (!patient) redirect(resultUrl("error", "Hasta bulunamadı veya bu kliniğe ait değil."));
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
  if (!doctor) redirect(resultUrl("error", "Doktor bulunamadı, aktif değil veya hastanın şubesinde çalışmıyor."));
  const paymentPlan = buildPaymentPlan({
    total: payload.estimatedFee,
    downPayment: payload.downPayment,
    installmentCount: payload.installmentCount,
    firstInstallmentDate: payload.firstInstallmentDate || null,
    note: payload.paymentPlanNote || null
  });
  await prisma.$transaction(async (tx) => {
    await tx.treatmentPlan.create({ data: {
      patientId: payload.patientId,
      doctorId: payload.doctorId,
      toothNumber: payload.toothNumber || null,
      treatmentType: payload.treatmentType,
      description: payload.description || null,
      estimatedFee: payload.estimatedFee,
      paymentPlan,
      status: payload.status as TreatmentStatus,
      plannedAt: payload.date ? new Date(payload.date) : new Date(),
      organizationId: session.organizationId,
      branchId: patient.branchId
    } });
    if (payload.downPayment > 0) await tx.payment.create({ data: {
      patientId: payload.patientId, type: PaymentType.INCOME, amount: payload.downPayment,
      listAmount: payload.estimatedFee, isDeposit: true, method: PaymentMethod.CASH,
      description: `${payload.treatmentType} tedavi planı peşinatı`, status: PaymentStatus.PAID,
      organizationId: session.organizationId, branchId: patient.branchId
    } });
  });
  revalidatePath("/dashboard/treatment-plans");
  redirect(resultUrl("success", "Tedavi planı kaydedildi."));
}

export default async function TreatmentPlansPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const query = await searchParams;
  const session = await requireModuleAccess("treatments");
  const locale = await getLocale();
  const [plans, patients, doctors] = await Promise.all([
    prisma.treatmentPlan.findMany({ where: { organizationId: session.organizationId, patient: { deletedAt: null } }, include: { patient: true, doctor: { select: { name: true } } }, orderBy: { plannedAt: "desc" }, take: 100 }),
    prisma.patient.findMany({ where: { organizationId: session.organizationId, deletedAt: null }, select: { id: true, firstName: true, lastName: true, branchId: true }, orderBy: { firstName: "asc" }, take: 200 }),
    prisma.user.findMany({ where: { organizationId: session.organizationId, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, active: true }, select: { id: true, name: true, branchId: true }, orderBy: { name: "asc" } })
  ]);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={ClipboardList} title="Tedavi Planlama" description="Hasta, diş numarası, önerilen tedavi, tahmini ücret, durum ve hekim takibi." />
      {query.success ? <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">{query.success}</div> : null}
      {query.error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{query.error}</div> : null}
      <Card>
        <CardHeader><CardTitle>Plan ekle</CardTitle></CardHeader>
        <CardContent>
          <form action={createPlanAction} className="grid gap-4 lg:grid-cols-4">
            <PatientDoctorFields patients={patients} doctors={doctors} />
            <div className="space-y-2"><Label>Diş no</Label><Input name="toothNumber" /></div>
            <div className="space-y-2"><Label>Tedavi türü</Label><Input name="treatmentType" placeholder="İmplant" required /></div>
            <div className="space-y-2"><Label>Tahmini ücret</Label><Input name="estimatedFee" type="number" min="0" defaultValue="0" /></div>
            <div className="space-y-2"><Label>Alınan peşinat</Label><Input name="downPayment" type="number" min="0" defaultValue="0" /></div>
            <div className="space-y-2"><Label>Taksit sayısı</Label><Select name="installmentCount" defaultValue="1"><option value="1">Tek çekim</option><option value="2">2 taksit</option><option value="3">3 taksit</option><option value="4">4 taksit</option><option value="6">6 taksit</option><option value="9">9 taksit</option><option value="12">12 taksit</option><option value="18">18 taksit</option><option value="24">24 taksit</option></Select></div>
            <div className="space-y-2"><Label>İlk taksit tarihi</Label><Input name="firstInstallmentDate" type="date" /></div>
            <div className="space-y-2"><Label>Durum</Label><Select name="status" defaultValue="PROPOSED"><option value="PROPOSED">Önerildi</option><option value="ACCEPTED">Kabul edildi</option><option value="STARTED">Başladı</option><option value="COMPLETED">Tamamlandı</option><option value="CANCELLED">İptal</option></Select></div>
            <div className="space-y-2"><Label>Tarih</Label><Input name="date" type="date" /></div>
            <div className="space-y-2 lg:col-span-2"><Label>Açıklama</Label><Textarea name="description" /></div>
            <div className="space-y-2 lg:col-span-2"><Label>Tahsilat planı notu</Label><Textarea name="paymentPlanNote" placeholder="Örn. Kalan tutar her ayın 15'inde alınacak." /></div>
            <Button className="w-fit lg:col-span-4" type="submit">Plan Kaydet</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Hasta</TableHead><TableHead>Doktor</TableHead><TableHead>Tedavi</TableHead><TableHead>Tahmini ücret</TableHead><TableHead>Ödeme planı</TableHead><TableHead>Durum</TableHead></TableRow></TableHeader>
            <TableBody>
              {plans.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDate(item.plannedAt, locale)}</TableCell>
                  <TableCell>{item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : "Hasta bulunamadı"}</TableCell>
                  <TableCell>{item.doctor?.name ?? "Doktor bulunamadı"}</TableCell>
                  <TableCell><Link className="font-medium text-primary hover:underline" href={`/dashboard/treatment-plans/${item.id}`}>{item.treatmentType} {item.toothNumber ? `#${item.toothNumber}` : ""}</Link></TableCell>
                  <TableCell>{formatCurrency(item.estimatedFee, locale)}</TableCell>
                  <TableCell>{summarizePaymentPlan(item.paymentPlan)}</TableCell>
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
