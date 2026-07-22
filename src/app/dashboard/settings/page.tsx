import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Database, Download, KeyRound, Languages, Plus, ShieldCheck, Settings, Trash2 } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { MfaSettings } from "@/components/dashboard/mfa-settings";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireModuleAccess } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { getProductionReadiness } from "@/lib/production-readiness";
import { roleLabel } from "@/lib/rbac";
import { cn, formatDateTime } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo-mode";
import { withSerializableTransaction } from "@/lib/services/appointmentAvailability";

function clinicChairs(value: unknown): string[] {
  if (!value || typeof value !== "object" || !("chairs" in value)) return [];
  const chairs = (value as { chairs?: unknown }).chairs;
  return Array.isArray(chairs) ? chairs.filter((item): item is string => typeof item === "string") : [];
}

function clinicSettings(value: unknown): Record<string, Prisma.InputJsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, Prisma.InputJsonValue>) };
}

function normalizeChairName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

async function updateClinicChairs(
  organizationId: string,
  update: (chairs: string[]) => string[]
) {
  return withSerializableTransaction(async (transaction) => {
    const organization = await transaction.organization.findUnique({ where: { id: organizationId }, select: { clinicSettings: true } });
    if (!organization) throw new Error("Klinik bulunamadı.");
    const chairs = update(clinicChairs(organization.clinicSettings));
    await transaction.organization.update({
      where: { id: organizationId },
      data: { clinicSettings: { ...clinicSettings(organization.clinicSettings), chairs } }
    });
  }, "Koltuk listesi aynı anda değiştirildi. Lütfen yeniden deneyin.");
}

async function renameClinicAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("settings");
  const name = String(formData.get("name") || "").trim();
  if (name.length < 2 || name.length > 120) throw new Error("Klinik adı 2-120 karakter olmalıdır.");
  await prisma.organization.updateMany({ where: { id: session.organizationId }, data: { name } });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

async function addChairAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("settings");
  const name = String(formData.get("name") || "").normalize("NFKC").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) throw new Error("Koltuk adı 2-80 karakter olmalıdır.");
  await updateClinicChairs(session.organizationId, (chairs) => {
    if (chairs.some((chair) => normalizeChairName(chair) === normalizeChairName(name))) return chairs;
    if (chairs.length >= 100) throw new Error("En fazla 100 koltuk tanımlanabilir.");
    return [...chairs, name];
  });
  revalidatePath("/dashboard/settings");
}

async function deleteChairAction(name: string) {
  "use server";
  const session = await requireModuleAccess("settings");
  const normalizedName = normalizeChairName(name);
  if (name.length < 2 || name.length > 80 || !normalizedName) throw new Error("Koltuk adı geçersiz.");
  await updateClinicChairs(session.organizationId, (chairs) => chairs.filter((chair) => normalizeChairName(chair) !== normalizedName));
  revalidatePath("/dashboard/settings");
}

async function requestDataDeletionAction() {
  "use server";
  const session = await requireModuleAccess("settings");
  const existing = await prisma.auditLog.findFirst({
    where: { organizationId: session.organizationId, action: "DATA_DELETION_REQUEST", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
  });
  if (!existing) {
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "DATA_DELETION_REQUEST",
        module: "privacy",
        organizationId: session.organizationId,
        branchId: session.branchId,
        metadata: { status: "REVIEW_REQUIRED" }
      }
    });
  }
  revalidatePath("/dashboard/settings");
}

export default async function SettingsPage() {
  const session = await requireModuleAccess("settings");
  const locale = await getLocale();
  const readiness = getProductionReadiness();
  const [organization, branches, users, auditLogs, currentUser] = await Promise.all([
    prisma.organization.findFirst({ where: { id: session.organizationId } }),
    prisma.branch.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({ where: { organizationId: session.organizationId }, include: { user: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { mfaEnabledAt: true } })
  ]);
  const chairs = clinicChairs(organization?.clinicSettings);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Settings} title="Ayarlar" description="Klinik, şube, kullanıcı rolleri, üretim hazırlığı, audit log ve veri hakları." />
      <Card className={readiness.ready ? "border-emerald-500/30" : "border-amber-500/40"}>
        <CardHeader><CardTitle className="flex items-center gap-2">{readiness.ready ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}Üretim hazırlığı</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {readiness.checks.map((check) => (
            <div key={check.key} className="rounded-md border bg-background p-3">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{check.label}</p><Badge variant={check.state === "pass" ? "success" : check.state === "error" ? "danger" : "warning"}>{check.state === "pass" ? "Hazır" : check.state === "error" ? "Eksik" : "Uyarı"}</Badge></div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{check.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card className="border-primary/25 bg-primary/5">
          <CardHeader><CardTitle className="flex items-center gap-2"><Languages className="h-5 w-5 text-primary" />Dil Tercihi</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Arayüz dilini hızlıca Türkçe veya İngilizce yap.</p>
            <LanguageToggle locale={locale} label="Dil" variant="prominent" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Organization</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="font-medium">{organization?.name}</div>
            <div className="text-muted-foreground">Plan: {organization?.plan}</div>
            <div className="text-muted-foreground">Tenant: {organization?.slug}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />KVKK</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Link className={cn(buttonVariants({ variant: "outline" }), "w-full gap-2")} href="/api/account/export"><Download className="h-4 w-4" />Verileri dışa aktar</Link>
            <form action={requestDataDeletionAction}><Button className="w-full" variant="outline" type="submit">Veri silme incelemesi iste</Button></form>
            <p className="text-xs leading-5 text-muted-foreground">Silme talepleri audit log’a alınır; yasal saklama zorunlulukları incelendikten sonra yetkili yönetici tarafından sonuçlandırılır.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" />Şubeler</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {branches.map((branch) => <div key={branch.id} className="rounded-md border bg-background p-2 text-sm">{branch.name} · {branch.city}</div>)}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Klinik adı</CardTitle></CardHeader><CardContent><form action={renameClinicAction} className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1 space-y-2"><Label>Görünen klinik adı</Label><Input name="name" defaultValue={organization?.name ?? ""} required /></div><Button type="submit">Adı güncelle</Button></form></CardContent></Card>
        <Card><CardHeader><CardTitle>Koltuk yönetimi</CardTitle></CardHeader><CardContent className="space-y-3"><form action={addChairAction} className="flex gap-2"><Input name="name" placeholder="Örn. Koltuk 4" required /><Button type="submit"><Plus className="h-4 w-4" />Ekle</Button></form><div className="space-y-2">{chairs.map((chair) => <div key={chair} className="flex items-center justify-between rounded-md border p-2 text-sm"><span>{chair}</span><form action={deleteChairAction.bind(null, chair)}><Button size="sm" variant="outline" type="submit"><Trash2 className="h-4 w-4" />Sil</Button></form></div>)}{chairs.length === 0 ? <p className="text-sm text-muted-foreground">Henüz koltuk tanımlanmadı.</p> : null}</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />İki aşamalı doğrulama</CardTitle></CardHeader>
        <CardContent><MfaSettings initialEnabled={Boolean(currentUser?.mfaEnabledAt)} demo={isDemoMode()} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Roller</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Kullanıcı</TableHead><TableHead>E-posta</TableHead><TableHead>Rol</TableHead><TableHead>Durum</TableHead></TableRow></TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}><TableCell>{user.name}</TableCell><TableCell>{user.email}</TableCell><TableCell>{roleLabel(user.role, locale)}</TableCell><TableCell><Badge variant={user.active ? "success" : "muted"}>{user.active ? "Aktif" : "Pasif"}</Badge></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Audit log</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Kullanıcı</TableHead><TableHead>Modül</TableHead><TableHead>Aksiyon</TableHead></TableRow></TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}><TableCell>{formatDateTime(log.createdAt, locale)}</TableCell><TableCell>{log.user?.name ?? "Sistem"}</TableCell><TableCell>{log.module}</TableCell><TableCell>{log.action}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
