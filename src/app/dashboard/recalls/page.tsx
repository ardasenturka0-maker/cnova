import { revalidatePath } from "next/cache";
import { BellRing } from "lucide-react";
import { RecallStatus } from "@prisma/client";
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
import { prisma } from "@/lib/prisma";
import { recallSchema } from "@/lib/validations/engagement";
import { formatDate } from "@/lib/utils";

async function createRecallAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const payload = recallSchema.parse(Object.fromEntries(formData));
  const patient = await prisma.patient.findFirst({ where: { id: payload.patientId, organizationId: session.organizationId, deletedAt: null }, select: { branchId: true } });
  if (!patient) throw new Error("Hasta bulunamadi.");
  await prisma.recall.create({
    data: {
      patientId: payload.patientId,
      reason: payload.reason,
      dueDate: new Date(payload.dueDate),
      status: payload.status as RecallStatus,
      notes: payload.notes || null,
      organizationId: session.organizationId,
      branchId: patient.branchId
    }
  });
  revalidatePath("/dashboard/recalls");
}

export default async function RecallsPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const [patients, recalls] = await Promise.all([
    prisma.patient.findMany({ where: { organizationId: session.organizationId, deletedAt: null }, orderBy: { firstName: "asc" }, take: 200 }),
    prisma.recall.findMany({ where: { organizationId: session.organizationId }, include: { patient: true, branch: true }, orderBy: { dueDate: "asc" }, take: 100 })
  ]);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={BellRing} title="Takipler" description="Tedavi sonrası takip, kontrol zamanı gelen hastalar ve geri arama listesi." />
      <Card>
        <CardHeader><CardTitle>Takip oluştur</CardTitle></CardHeader>
        <CardContent>
          <form action={createRecallAction} className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-2"><Label>Hasta</Label><Select name="patientId" required><option value="">Seçin</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</Select></div>
            <div className="space-y-2"><Label>Neden</Label><Input name="reason" required /></div>
            <div className="space-y-2"><Label>Tarih</Label><Input name="dueDate" type="date" required /></div>
            <div className="space-y-2"><Label>Durum</Label><Select name="status" defaultValue="OPEN"><option value="OPEN">Açık</option><option value="CONTACTED">Arandı</option><option value="SCHEDULED">Planlandı</option><option value="CLOSED">Kapandı</option></Select></div>
            <div className="space-y-2 lg:col-span-4"><Label>Not</Label><Textarea name="notes" /></div>
            <Button className="w-fit lg:col-span-4" type="submit">Takip Kaydet</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Hasta</TableHead><TableHead>Neden</TableHead><TableHead>Şube</TableHead><TableHead>Durum</TableHead><TableHead>Not</TableHead></TableRow></TableHeader>
            <TableBody>
              {recalls.map((recall) => (
                <TableRow key={recall.id}><TableCell>{formatDate(recall.dueDate, locale)}</TableCell><TableCell>{recall.patient.firstName} {recall.patient.lastName}</TableCell><TableCell>{recall.reason}</TableCell><TableCell>{recall.branch.name}</TableCell><TableCell><Badge variant={recall.status === "CLOSED" ? "success" : "warning"}>{statusLabel(recall.status, locale)}</Badge></TableCell><TableCell>{recall.notes ?? "-"}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
