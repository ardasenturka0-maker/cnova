import { Database, KeyRound, ShieldCheck, Settings } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";

export default async function SettingsPage() {
  const session = await requireSession();
  const locale = getLocale();
  const [organization, branches, users, auditLogs] = await Promise.all([
    prisma.organization.findFirst({ where: { id: session.organizationId } }),
    prisma.branch.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({ where: { organizationId: session.organizationId }, include: { user: true }, orderBy: { createdAt: "desc" }, take: 30 })
  ]);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Settings} title="Ayarlar" description="Organization, branch, kullanıcı rolleri, audit log ve KVKK mock işlemleri." />
      <div className="grid gap-4 lg:grid-cols-3">
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
            <Button variant="outline" type="button">Veri dışa aktarma mock</Button>
            <Button variant="outline" type="button">Veri silme isteği mock</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" />Şubeler</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {branches.map((branch) => <div key={branch.id} className="rounded-md border bg-background p-2 text-sm">{branch.name} · {branch.city}</div>)}
          </CardContent>
        </Card>
      </div>
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
