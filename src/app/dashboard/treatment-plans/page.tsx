import { revalidatePath } from "next/cache";
import { ClipboardList } from "lucide-react";
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
import { prisma } from "@/lib/prisma";
import { treatmentPlanSchema } from "@/lib/validations/treatment";
import { formatCurrency, formatDate } from "@/lib/utils";

async function createPlanAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const payload = treatmentPlanSchema.parse(Object.fromEntries(formData));
  const patient = await prisma.patient.findFirst({ where: { id: payload.patientId, organizationId: session.organizationId }, select: { branchId: true } });
  if (!patient) throw new Error("Hasta bulunamadi.");
  await prisma.treatmentPlan.create({
    data: {
      patientId: payload.patientId,
      doctorId: payload.doctorId,
      toothNumber: payload.toothNumber || null,
      treatmentType: payload.treatmentType,
      description: payload.description || null,
      estimatedFee: payload.estimatedFee,
      status: payload.status as TreatmentStatus,
      plannedAt: payload.date ? new Date(payload.date) : new Date(),
      organizationId: session.organizationId,
      branchId: patient.branchId
    }
  });
  revalidatePath("/dashboard/treatment-plans");
}

export default async function TreatmentPlansPage() {
  const session = await requireSession();
  const locale = getLocale();
  const [plans, patients, doctors] = await Promise.all([
    prisma.treatmentPlan.findMany({ where: { organizationId: session.organizationId }, include: { patient: true, doctor: { select: { name: true } } }, orderBy: { plannedAt: "desc" }, take: 100 }),
    prisma.patient.findMany({ where: { organizationId: session.organizationId }, orderBy: { firstName: "asc" }, take: 200 }),
    prisma.user.findMany({ where: { organizationId: session.organizationId, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] } }, orderBy: { name: "asc" } })
  ]);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={ClipboardList} title="Tedavi Planlama" description="Hasta, diş numarası, önerilen tedavi, tahmini ücret, durum ve hekim takibi." />
      <Card>
        <CardHeader><CardTitle>Plan ekle</CardTitle></CardHeader>
        <CardContent>
          <form action={createPlanAction} className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-2"><Label>Hasta</Label><Select name="patientId" required><option value="">Seçin</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</Select></div>
            <div className="space-y-2"><Label>Doktor</Label><Select name="doctorId" required><option value="">Seçin</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></div>
            <div className="space-y-2"><Label>Diş no</Label><Input name="toothNumber" /></div>
            <div className="space-y-2"><Label>Tedavi türü</Label><Input name="treatmentType" placeholder="İmplant" required /></div>
            <div className="space-y-2"><Label>Tahmini ücret</Label><Input name="estimatedFee" type="number" min="0" defaultValue="0" /></div>
            <div className="space-y-2"><Label>Durum</Label><Select name="status" defaultValue="PROPOSED"><option value="PROPOSED">Önerildi</option><option value="ACCEPTED">Kabul edildi</option><option value="STARTED">Başladı</option><option value="COMPLETED">Tamamlandı</option><option value="CANCELLED">İptal</option></Select></div>
            <div className="space-y-2"><Label>Tarih</Label><Input name="date" type="date" /></div>
            <div className="space-y-2 lg:col-span-4"><Label>Açıklama</Label><Textarea name="description" /></div>
            <Button className="w-fit lg:col-span-4" type="submit">Plan Kaydet</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Hasta</TableHead><TableHead>Doktor</TableHead><TableHead>Tedavi</TableHead><TableHead>Tahmini ücret</TableHead><TableHead>Durum</TableHead></TableRow></TableHeader>
            <TableBody>
              {plans.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDate(item.plannedAt, locale)}</TableCell>
                  <TableCell>{item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : "Hasta bulunamadı"}</TableCell>
                  <TableCell>{item.doctor?.name ?? "Doktor bulunamadı"}</TableCell>
                  <TableCell>{item.treatmentType} {item.toothNumber ? `#${item.toothNumber}` : ""}</TableCell>
                  <TableCell>{formatCurrency(item.estimatedFee, locale)}</TableCell>
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
