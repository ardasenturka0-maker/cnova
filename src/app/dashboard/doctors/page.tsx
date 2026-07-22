import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { Stethoscope, Trash2 } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { requireModuleAccess } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { getDashboardMetrics } from "@/lib/services/reportService";
import { formatCurrency } from "@/lib/utils";
import { doctorSchema } from "@/lib/validations/staff";
import { idSchema } from "@/lib/validations/common";

async function createDoctorAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("staff");
  const parsed = doctorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Doktor adı, e-posta adresi veya şube geçersiz.");
  const { name, email, branchId } = parsed.data;
  const branch = await prisma.branch.findFirst({ where: { id: branchId, organizationId: session.organizationId }, select: { id: true } });
  if (!branch) throw new Error("Şube bulunamadı.");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.organizationId !== session.organizationId) throw new Error("Bu e-posta başka bir klinikte kayıtlı.");
  if (existing && existing.role !== Role.DOCTOR) throw new Error("Bu e-posta başka bir personel rolü tarafından kullanılıyor.");
  if (existing) await prisma.user.update({ where: { id: existing.id }, data: { name, active: true, branchId } });
  else await prisma.user.create({ data: { name, email, passwordHash: await hashPassword(crypto.randomUUID()), role: Role.DOCTOR, active: true, organizationId: session.organizationId, branchId } });
  revalidatePath("/dashboard/doctors");
}

async function deactivateDoctorAction(id: string) {
  "use server";
  const session = await requireModuleAccess("staff");
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) throw new Error("Doktor kimliği geçersiz.");
  await prisma.user.updateMany({ where: { id: parsedId.data, organizationId: session.organizationId, role: Role.DOCTOR }, data: { active: false } });
  revalidatePath("/dashboard/doctors");
}

export default async function DoctorsPage() {
  const session = await requireModuleAccess("staff");
  const locale = await getLocale();
  const [doctors, branches, metrics] = await Promise.all([
    prisma.user.findMany({ where: { organizationId: session.organizationId, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] } }, include: { branch: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: "asc" } }),
    getDashboardMetrics(session.organizationId)
  ]);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Stethoscope} title="Hekim Yönetimi" description="Randevu sayısı, tamamlanan tedavi, üretilen gelir, memnuniyet ve haftalık takvim." />
      <Card><CardHeader><CardTitle>Doktor ekle</CardTitle></CardHeader><CardContent><form action={createDoctorAction} className="grid gap-4 md:grid-cols-4"><div className="space-y-2"><Label>Ad soyad</Label><Input name="name" placeholder="Dr. Ad Soyad" required /></div><div className="space-y-2"><Label>E-posta</Label><Input name="email" type="email" required /></div><div className="space-y-2"><Label>Şube</Label><Select name="branchId" required>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></div><Button className="self-end" type="submit">Doktoru kaydet</Button></form><p className="mt-3 text-xs text-muted-foreground">Yeni doktor randevu ve tedavi seçimlerine hemen eklenir. Giriş yetkisi gerekiyorsa güvenli parola sıfırlama akışı kullanılmalıdır.</p></CardContent></Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {doctors.map((doctor) => {
          const performance = metrics.doctorPerformance.find((item) => item.name === doctor.name);
          return (
            <Card key={doctor.id} className={!doctor.active ? "opacity-60" : undefined}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{doctor.name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{doctor.email} · {doctor.branch?.name ?? "Tüm şubeler"}</p>
                  </div>
                  <Badge variant={doctor.active ? "success" : "muted"}>{doctor.active ? "Aktif" : "Silindi"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border bg-background p-3"><p className="text-xs text-muted-foreground">Randevu</p><p className="text-xl font-semibold">{performance?.appointments ?? 0}</p></div>
                <div className="rounded-md border bg-background p-3"><p className="text-xs text-muted-foreground">Tedavi</p><p className="text-xl font-semibold">{performance?.treatments ?? 0}</p></div>
                <div className="rounded-md border bg-background p-3"><p className="text-xs text-muted-foreground">Gelir</p><p className="text-xl font-semibold">{formatCurrency(performance?.revenue ?? 0, locale)}</p></div>
                <div className="rounded-md border bg-background p-3"><p className="text-xs text-muted-foreground">Şube</p><p className="text-base font-semibold">{doctor.branch?.name ?? "Tüm şubeler"}</p></div>
                {doctor.role === Role.DOCTOR && doctor.active ? <form action={deactivateDoctorAction.bind(null, doctor.id)} className="sm:col-span-2"><Button variant="outline" type="submit"><Trash2 className="h-4 w-4" />Doktoru sil</Button></form> : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
