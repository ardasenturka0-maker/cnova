import { revalidatePath } from "next/cache";
import { RotateCcw, UserMinus, UserRoundCog } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireModuleAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { staffSchema } from "@/lib/validations/staff";

async function createStaffAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("staff");
  const branchId = await getWritableBranchId(session);
  const payload = staffSchema.parse(Object.fromEntries(formData));
  await prisma.staff.create({
    data: {
      fullName: payload.fullName,
      roleLabel: payload.roleLabel,
      phone: payload.phone || null,
      email: payload.email || null,
      workingHours: payload.workingHours || null,
      compensation: payload.compensation || null,
      active: payload.active === "true",
      organizationId: session.organizationId,
      branchId
    }
  });
  revalidatePath("/dashboard/staff");
}

async function setStaffActiveAction(staffId: string, active: boolean) {
  "use server";
  const session = await requireModuleAccess("staff");
  if (!staffId || staffId.length > 128) throw new Error("Personel kaydı geçersiz.");
  const result = await prisma.staff.updateMany({
    where: { id: staffId, organizationId: session.organizationId },
    data: { active }
  });
  if (!result.count) throw new Error("Personel kaydı bulunamadı.");
  revalidatePath("/dashboard/staff");
}

export default async function StaffPage() {
  const session = await requireModuleAccess("staff");
  const staff = await prisma.staff.findMany({
    where: { organizationId: session.organizationId },
    include: { branch: true, doctorProfile: true },
    orderBy: { fullName: "asc" }
  });

  return (
    <div className="space-y-6">
      <ModuleHeader icon={UserRoundCog} title="Personel Modülü" description="Rol, iletişim, çalışma saatleri, maaş/hakediş ve aktif/pasif durum." actionHref="/dashboard/doctors" actionLabel="Hekimler" />
      <Card>
        <CardHeader><CardTitle>Personel ekle</CardTitle></CardHeader>
        <CardContent>
          <form action={createStaffAction} className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-2"><Label>Ad soyad</Label><Input name="fullName" required /></div>
            <div className="space-y-2"><Label>Rol</Label><Input name="roleLabel" required /></div>
            <div className="space-y-2"><Label>Telefon</Label><Input name="phone" /></div>
            <div className="space-y-2"><Label>E-posta</Label><Input name="email" type="email" /></div>
            <div className="space-y-2"><Label>Çalışma saatleri</Label><Input name="workingHours" placeholder="09:00-18:00" /></div>
            <div className="space-y-2"><Label>Maaş / hakediş</Label><Input name="compensation" /></div>
            <div className="space-y-2"><Label>Durum</Label><Select name="active" defaultValue="true"><option value="true">Aktif</option><option value="false">Pasif</option></Select></div>
            <Button className="w-fit self-end" type="submit">Personel Kaydet</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Ad soyad</TableHead><TableHead>Rol</TableHead><TableHead>Telefon</TableHead><TableHead>E-posta</TableHead><TableHead>Şube</TableHead><TableHead>Çalışma</TableHead><TableHead>Durum</TableHead><TableHead>Personel işlemi</TableHead></TableRow></TableHeader>
            <TableBody>
              {staff.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.fullName}</TableCell>
                  <TableCell>{item.roleLabel}</TableCell>
                  <TableCell>{item.phone ?? "-"}</TableCell>
                  <TableCell>{item.email ?? "-"}</TableCell>
                  <TableCell>{item.branch.name}</TableCell>
                  <TableCell>{item.workingHours ?? "-"}</TableCell>
                  <TableCell><Badge variant={item.active ? "success" : "muted"}>{item.active ? "Aktif" : "Pasif"}</Badge></TableCell>
                  <TableCell>
                    <form action={setStaffActiveAction.bind(null, item.id, !item.active)}>
                      <Button variant={item.active ? "destructive" : "outline"} size="sm" type="submit">
                        {item.active ? <UserMinus className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                        {item.active ? "Personeli çıkar" : "Yeniden aktifleştir"}
                      </Button>
                    </form>
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
