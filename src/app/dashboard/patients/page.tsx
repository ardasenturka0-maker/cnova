import { Trash2, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getPatients } from "@/lib/services/patientService";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

function tagVariant(tag: string): "success" | "danger" | "warning" | "muted" {
  if (tag === "VIP") return "success";
  if (tag === "RISKY") return "danger";
  if (tag === "NEW") return "warning";
  return "muted";
}

export default async function PatientsPage(props: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const patients = await getPatients(session.organizationId, searchParams.q);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Users} title="Hasta Modülü" description="Hasta kayıtları, etiketler, son ziyaret, ödeme ve takip geçmişi." actionHref="/dashboard/patients/new" actionLabel="Yeni Hasta" />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hasta</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Etiket</TableHead>
                <TableHead>Şube</TableHead>
                <TableHead>Son ziyaret</TableHead>
                <TableHead>Son ödemeler</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((patient) => {
                const paymentTotal = patient.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
                return (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <div className="font-medium">{patient.firstName} {patient.lastName}</div>
                      <div className="text-xs text-muted-foreground">{patient.email ?? "E-posta yok"}</div>
                    </TableCell>
                    <TableCell>{patient.phone}</TableCell>
                    <TableCell><Badge variant={tagVariant(patient.tag)}>{statusLabel(patient.tag, locale)}</Badge></TableCell>
                    <TableCell>{patient.branch.name}</TableCell>
                    <TableCell>{patient.lastVisitAt ? formatDate(patient.lastVisitAt, locale) : "Yeni kayıt"}</TableCell>
                    <TableCell>{formatCurrency(paymentTotal, locale)}</TableCell>
                    <TableCell className="text-right">
                      <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/dashboard/patients/${patient.id}`}>
                        Detay
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
              {patients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Hasta bulunamadı.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Link className={cn(buttonVariants({ variant: "outline" }), "w-fit")} href="/dashboard/patients/new">
        <UserPlus className="h-4 w-4" />
        Yeni hasta ekle
      </Link>
      <Link className={cn(buttonVariants({ variant: "ghost" }), "w-fit")} href="/dashboard/patients/trash">
        <Trash2 className="h-4 w-4" />
        Çöp kutusu
      </Link>
    </div>
  );
}
