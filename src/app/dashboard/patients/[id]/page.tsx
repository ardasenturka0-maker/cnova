import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { Save, Trash2, Users } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { deletePatient, getPatientById, updatePatient } from "@/lib/services/patientService";
import { patientSchema } from "@/lib/validations/patient";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

async function updatePatientAction(id: string, formData: FormData) {
  "use server";
  const session = await requireSession();
  const payload = patientSchema.parse(Object.fromEntries(formData));
  await updatePatient(session.organizationId, id, payload);
  revalidatePath(`/dashboard/patients/${id}`);
}

async function deletePatientAction(id: string) {
  "use server";
  const session = await requireSession();
  await deletePatient(session.organizationId, id);
  revalidatePath("/dashboard/patients");
  redirect("/dashboard/patients");
}

export default async function PatientDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const locale = getLocale();
  const patient = await getPatientById(session.organizationId, params.id);

  if (!patient) {
    notFound();
  }

  const totalPaid = patient.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

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
            <form action={deletePatientAction.bind(null, patient.id)} className="mt-3">
              <Button type="submit" variant="destructive">
                <Trash2 className="h-4 w-4" />
                Hastayı Sil
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Hasta özeti</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
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

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Tedavi geçmişi</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {patient.treatments.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-md border bg-background p-3 text-sm">
                <div className="font-medium">{item.treatmentType} · {formatCurrency(item.fee, locale)}</div>
                <div className="text-xs text-muted-foreground">{item.doctor.name} · {formatDate(item.performedAt, locale)}</div>
              </div>
            ))}
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
          <CardHeader><CardTitle>Onam, anket ve recall</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md border bg-background p-3">{patient.consents.length} dijital onam kaydı</div>
            <div className="rounded-md border bg-background p-3">{patient.surveyResponses.length} memnuniyet anketi</div>
            <div className="rounded-md border bg-background p-3">{patient.recalls.length} takip kaydı</div>
            <div className="rounded-md border bg-background p-3">Dosyalar: mock klasör hazır</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
