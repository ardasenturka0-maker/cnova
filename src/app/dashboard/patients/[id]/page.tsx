import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { History, PlayCircle, Save, Users } from "lucide-react";
import { DeletePatientButton } from "@/components/dashboard/delete-patient-button";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { PatientFiles, type PatientFileMeta } from "@/components/dashboard/patient-files";
import { TreatmentStatusBadge } from "@/components/dashboard/treatment-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { canDeletePatientFile, canManageTrash, requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getPatientById, updatePatient } from "@/lib/services/patientService";
import { getCompletedTreatmentHistory } from "@/lib/services/treatmentHistoryService";
import { prisma } from "@/lib/prisma";
import { patientSchema } from "@/lib/validations/patient";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

async function updatePatientAction(id: string, formData: FormData) {
  "use server";
  const session = await requireSession();
  const payload = patientSchema.parse(Object.fromEntries(formData));
  await updatePatient(session.organizationId, id, payload);
  revalidatePath(`/dashboard/patients/${id}`);
}

export default async function PatientDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireSession();
  const locale = await getLocale();
  const patient = await getPatientById(session.organizationId, params.id);

  if (!patient) {
    notFound();
  }

  const [patientFiles, completedTreatments] = await Promise.all([
    prisma.patientFile.findMany({
      where: { patientId: patient.id, organizationId: session.organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    }),
    getCompletedTreatmentHistory(session.organizationId, { patientId: patient.id, take: 100 })
  ]);
  const initialFiles: PatientFileMeta[] = patientFiles.map((file) => ({
    id: file.id,
    category: file.category,
    fileName: file.fileName,
    mimeType: file.mimeType,
    size: file.size,
    note: file.note,
    createdAt: file.createdAt.toISOString()
  }));

  const totalPaid = patient.payments.filter((payment) => payment.status === "PAID").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const activeTreatments = patient.treatments.filter((treatment) => ["PROPOSED", "ACCEPTED", "STARTED"].includes(treatment.status));

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Users} title={`${patient.firstName} ${patient.lastName}`} description={`${patient.branch.name} · ${patient.phone} · kayıt: ${formatDate(patient.createdAt, locale)}`} />
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Genel bilgiler</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updatePatientAction.bind(null, patient.id)} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Ad</Label>
                  <Input id="firstName" name="firstName" defaultValue={patient.firstName} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Soyad</Label>
                  <Input id="lastName" name="lastName" defaultValue={patient.lastName} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input id="phone" name="phone" defaultValue={patient.phone} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta</Label>
                  <Input id="email" name="email" type="email" defaultValue={patient.email ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationalId">TC kimlik no</Label>
                  <Input id="nationalId" name="nationalId" defaultValue={patient.nationalId ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Doğum tarihi</Label>
                  <Input id="birthDate" name="birthDate" type="date" defaultValue={patient.birthDate ? patient.birthDate.toISOString().slice(0, 10) : ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Cinsiyet</Label>
                  <Select id="gender" name="gender" defaultValue={patient.gender}>
                    <option value="UNSPECIFIED">Belirtilmedi</option>
                    <option value="FEMALE">Kadın</option>
                    <option value="MALE">Erkek</option>
                    <option value="OTHER">Diğer</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag">Etiket</Label>
                  <Select id="tag" name="tag" defaultValue={patient.tag}>
                    <option value="NEW">Yeni</option>
                    <option value="ACTIVE">Aktif</option>
                    <option value="PASSIVE">Pasif</option>
                    <option value="RISKY">Riskli</option>
                    <option value="VIP">VIP</option>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Adres</Label>
                <Textarea id="address" name="address" defaultValue={patient.address ?? ""} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="allergies">Alerji</Label>
                  <Textarea id="allergies" name="allergies" defaultValue={patient.allergies ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chronicDiseases">Kronik hastalık</Label>
                  <Textarea id="chronicDiseases" name="chronicDiseases" defaultValue={patient.chronicDiseases ?? ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notlar</Label>
                <Textarea id="notes" name="notes" defaultValue={patient.notes ?? ""} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">
                  <Save className="h-4 w-4" />
                  Güncelle
                </Button>
              </div>
            </form>
            {canManageTrash(session.role) ? <DeletePatientButton patientId={patient.id} /> : null}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Hasta özeti</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs text-muted-foreground">Toplam ödeme</p>
                <p className="mt-1 text-xl font-semibold">{formatCurrency(totalPaid, locale)}</p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs text-muted-foreground">Randevu</p>
                <p className="mt-1 text-xl font-semibold">{patient.appointments.length}</p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs text-muted-foreground">Etiket</p>
                <p className="mt-2"><Badge>{statusLabel(patient.tag, locale)}</Badge></p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs text-muted-foreground">Tamamlanan tedavi</p>
                <p className="mt-1 text-xl font-semibold">{completedTreatments.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Randevu geçmişi</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Doktor</TableHead><TableHead>İşlem</TableHead><TableHead>Durum</TableHead></TableRow></TableHeader>
                <TableBody>
                  {patient.appointments.slice(0, 6).map((item) => (
                    <TableRow key={item.id}><TableCell>{formatDateTime(item.startsAt, locale)}</TableCell><TableCell>{item.doctor.name}</TableCell><TableCell>{item.treatmentType}</TableCell><TableCell><Badge variant="muted">{statusLabel(item.status, locale)}</Badge></TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <PatientFiles patientId={patient.id} initialFiles={initialFiles} canDelete={canDeletePatientFile(session.role)} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-emerald-600" />Geçmiş tedaviler</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {completedTreatments.slice(0, 10).map((item) => (
              <div key={item.id} className="rounded-md border bg-background p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2"><div className="font-medium">{item.treatmentType}{item.toothNumber ? ` · Diş ${item.toothNumber}` : ""} · {formatCurrency(item.fee, locale)}</div><TreatmentStatusBadge status={item.status} locale={locale} /></div>
                <div className="mt-1 text-xs text-muted-foreground">{item.doctor.name} · tamamlanma/işlem tarihi: {formatDate(item.performedAt, locale)}</div>
              </div>
            ))}
            {!completedTreatments.length ? <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Tedavi modülünde bitirilen işlemler otomatik olarak burada görünür.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><PlayCircle className="h-5 w-5 text-amber-600" />Devam eden tedaviler</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {activeTreatments.slice(0, 10).map((item) => <div key={item.id} className="rounded-md border bg-background p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2"><span className="font-medium">{item.treatmentType}{item.toothNumber ? ` · Diş ${item.toothNumber}` : ""}</span><TreatmentStatusBadge status={item.status} locale={locale} /></div>
              <p className="mt-1 text-xs text-muted-foreground">{item.doctor.name} · {formatDate(item.performedAt, locale)}</p>
            </div>)}
            {!activeTreatments.length ? <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Devam eden tedavi yok.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ödeme geçmişi</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {patient.payments.slice(0, 6).map((item) => (
              <div key={item.id} className="flex justify-between rounded-md border bg-background p-3 text-sm">
                <span>{item.description ?? item.method}</span>
                <Badge variant={item.status === "PAID" ? "success" : "warning"}>{formatCurrency(item.amount, locale)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Klinik dosyası</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md border bg-background p-3">{patient.consents.length} dijital onam kaydı</div>
            <div className="rounded-md border bg-background p-3">{initialFiles.length} dosya / fotoğraf</div>
            <div className="rounded-md border bg-background p-3">{completedTreatments.length} tamamlanan tedavi kaydı</div>
            <div className="rounded-md border bg-background p-3">{activeTreatments.length} devam eden tedavi kaydı</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
