import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Save, Users } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireSession } from "@/lib/auth";
import { createPatient } from "@/lib/services/patientService";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { patientSchema } from "@/lib/validations/patient";

async function createPatientAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const branchId = await getWritableBranchId(session);
  const payload = patientSchema.parse(Object.fromEntries(formData));
  const patient = await createPatient(session.organizationId, branchId, payload);
  revalidatePath("/dashboard/patients");
  redirect(`/dashboard/patients/${patient.id}`);
}

export default function NewPatientPage() {
  return (
    <div className="space-y-6">
      <ModuleHeader icon={Users} title="Yeni Hasta" description="Hasta temel bilgileri, medikal uyarılar ve takip etiketi." />
      <Card>
        <CardContent className="p-5">
          <form action={createPatientAction} className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Ad</Label>
                <Input id="firstName" name="firstName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Soyad</Label>
                <Input id="lastName" name="lastName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input id="phone" name="phone" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationalId">TC kimlik no</Label>
                <Input id="nationalId" name="nationalId" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Doğum tarihi</Label>
                <Input id="birthDate" name="birthDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Cinsiyet</Label>
                <Select id="gender" name="gender" defaultValue="UNSPECIFIED">
                  <option value="UNSPECIFIED">Belirtilmedi</option>
                  <option value="FEMALE">Kadın</option>
                  <option value="MALE">Erkek</option>
                  <option value="OTHER">Diğer</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag">Hasta etiketi</Label>
                <Select id="tag" name="tag" defaultValue="NEW">
                  <option value="NEW">Yeni</option>
                  <option value="ACTIVE">Aktif</option>
                  <option value="PASSIVE">Pasif</option>
                  <option value="RISKY">Riskli</option>
                  <option value="VIP">VIP</option>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="allergies">Alerji bilgisi</Label>
                <Textarea id="allergies" name="allergies" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chronicDiseases">Kronik hastalık</Label>
                <Textarea id="chronicDiseases" name="chronicDiseases" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adres</Label>
              <Textarea id="address" name="address" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notlar</Label>
              <Textarea id="notes" name="notes" />
            </div>
            <Button className="w-fit" type="submit">
              <Save className="h-4 w-4" />
              Hastayı Kaydet
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
