import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArchiveRestore, Boxes, ChevronLeft, ChevronRight, FileText, Trash2 } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canManageTrash, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { restorePatient, getDeletedPatients } from "@/lib/services/patientService";
import { getDeletedStockItems, restoreStockItem } from "@/lib/services/stockService";
import { writeAuditLog } from "@/lib/services/auditLogService";
import { cn, formatDateTime } from "@/lib/utils";

async function restorePatientAction(id: string) {
  "use server";
  const session = await requireSession();
  if (!canManageTrash(session.role)) redirect("/dashboard?error=forbidden");
  await restorePatient(session.organizationId, id, session.userId, session.branchId);
  revalidatePath("/dashboard/patients");
  revalidatePath("/dashboard/patients/trash");
}

async function restoreFileAction(id: string) {
  "use server";
  const session = await requireSession();
  if (!canManageTrash(session.role)) redirect("/dashboard?error=forbidden");
  const now = new Date();
  const file = await prisma.patientFile.findFirst({
    where: {
      id,
      organizationId: session.organizationId,
      deletedAt: { not: null },
      purgeAt: { gt: now },
      patient: { deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }
    }
  });
  if (!file) return;
  await prisma.patientFile.update({ where: { id: file.id }, data: { deletedAt: null, purgeAt: null, restoredAt: now, restoredById: session.userId } });
  await writeAuditLog({ userId: session.userId, action: "RESTORE_PATIENT_FILE", module: "patients", entityId: file.id, metadata: { patientId: file.patientId }, organizationId: session.organizationId, branchId: session.branchId });
  revalidatePath("/dashboard/patients/trash");
  revalidatePath(`/dashboard/patients/${file.patientId}`);
}

async function restoreStockAction(id: string) {
  "use server";
  const session = await requireSession();
  if (!canManageTrash(session.role)) redirect("/dashboard?error=forbidden");
  await restoreStockItem(session.organizationId, id, session.userId, session.branchId);
  revalidatePath("/dashboard/stocks");
  revalidatePath("/dashboard/patients/trash");
}

export default async function PatientTrashPage(props: { searchParams: Promise<{ stockPage?: string }> }) {
  const session = await requireSession();
  if (!canManageTrash(session.role)) redirect("/dashboard?error=forbidden");
  const searchParams = await props.searchParams;
  const parsedStockPage = Number.parseInt(searchParams.stockPage ?? "1", 10);
  const stockPage = Number.isSafeInteger(parsedStockPage) && parsedStockPage > 0 ? parsedStockPage : 1;
  const [patients, files, stockTrash] = await Promise.all([
    getDeletedPatients(session.organizationId, session.branchId),
    prisma.patientFile.findMany({
      where: {
        organizationId: session.organizationId,
        deletedAt: { not: null },
        purgeAt: { gt: new Date() },
        patient: { deletedAt: null, ...(session.branchId ? { branchId: session.branchId } : {}) }
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { deletedAt: "desc" },
      take: 200
    }),
    getDeletedStockItems(session.organizationId, { page: stockPage, branchId: session.branchId })
  ]);
  const stockItems = stockTrash.items;

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Trash2} title="Çöp kutusu" description="Silinen hasta, dosya ve stoklar 30 gün boyunca geri yüklenebilir; süre sonunda otomatik olarak kalıcı silinir." />
      <Card>
        <CardHeader><CardTitle>Silinen hastalar</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table><TableHeader><TableRow><TableHead>Hasta</TableHead><TableHead>Silinme</TableHead><TableHead>Kalıcı silinme</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{patients.map((patient) => <TableRow key={patient.id}><TableCell>{patient.firstName} {patient.lastName}<div className="text-xs text-muted-foreground">{patient.branch.name}</div></TableCell><TableCell>{patient.deletedAt ? formatDateTime(patient.deletedAt, "tr") : "-"}</TableCell><TableCell>{patient.purgeAt ? formatDateTime(patient.purgeAt, "tr") : "-"}</TableCell><TableCell className="text-right"><form action={restorePatientAction.bind(null, patient.id)}><Button size="sm" variant="outline"><ArchiveRestore className="h-4 w-4" />Geri yükle</Button></form></TableCell></TableRow>)}{patients.length === 0 ? <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Silinen hasta yok.</TableCell></TableRow> : null}</TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Silinen dosyalar</CardTitle></CardHeader>
        <CardContent className="space-y-2">{files.map((file) => <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div className="flex items-center gap-2"><FileText className="h-4 w-4" /><div><div className="font-medium">{file.fileName}</div><div className="text-xs text-muted-foreground">{file.patient.firstName} {file.patient.lastName} · {file.purgeAt ? formatDateTime(file.purgeAt, "tr") : "-"}</div></div></div><form action={restoreFileAction.bind(null, file.id)}><Button size="sm" variant="outline"><ArchiveRestore className="h-4 w-4" />Geri yükle</Button></form></div>)}{files.length === 0 ? <p className="text-sm text-muted-foreground">Silinen dosya yok.</p> : null}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5" />Silinen stoklar ({stockTrash.total})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Ürün</TableHead><TableHead>Şube</TableHead><TableHead>Silinme</TableHead><TableHead>Kalıcı silinme</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {stockItems.map((item) => <TableRow key={item.id}>
                <TableCell><span className="font-medium">{item.name}</span><div className="text-xs text-muted-foreground">{item.category} · {item.currentQuantity} {item.unit}</div></TableCell>
                <TableCell>{item.branch.name}</TableCell>
                <TableCell>{item.deletedAt ? formatDateTime(item.deletedAt, "tr") : "-"}</TableCell>
                <TableCell>{item.purgeAt ? formatDateTime(item.purgeAt, "tr") : "-"}</TableCell>
                <TableCell className="text-right"><form action={restoreStockAction.bind(null, item.id)}><Button size="sm" variant="outline"><ArchiveRestore className="h-4 w-4" />Geri yükle</Button></form></TableCell>
              </TableRow>)}
              {!stockItems.length ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Silinen stok yok.</TableCell></TableRow> : null}
            </TableBody>
          </Table>
          {stockTrash.totalPages > 1 ? <nav aria-label="Silinen stok sayfaları" className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
            <span className="text-sm text-muted-foreground">Sayfa {stockTrash.page} / {stockTrash.totalPages}</span>
            <div className="flex items-center gap-2">
              {stockTrash.page > 1
                ? <Link href={`/dashboard/patients/trash?stockPage=${stockTrash.page - 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}><ChevronLeft className="h-4 w-4" />Önceki</Link>
                : <span aria-disabled="true" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")}><ChevronLeft className="h-4 w-4" />Önceki</span>}
              {stockTrash.page < stockTrash.totalPages
                ? <Link href={`/dashboard/patients/trash?stockPage=${stockTrash.page + 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Sonraki<ChevronRight className="h-4 w-4" /></Link>
                : <span aria-disabled="true" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")}>Sonraki<ChevronRight className="h-4 w-4" /></span>}
            </div>
          </nav> : null}
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/patients" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>Hasta listesine dön</Link>
        <Link href="/dashboard/stocks" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>Stok listesine dön</Link>
      </div>
    </div>
  );
}
