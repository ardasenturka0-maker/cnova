import { revalidatePath } from "next/cache";
import { BadgePercent, CalendarClock, CreditCard, WalletCards } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { PaymentForm } from "@/components/forms/payment-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { createPayment, getFinanceOverview } from "@/lib/services/financeService";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { paymentSchema } from "@/lib/validations/finance";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";

async function createPaymentAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const branchId = await getWritableBranchId(session);
  const payload = paymentSchema.parse(Object.fromEntries(formData));
  await createPayment(session.organizationId, branchId, payload);
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/finance");
}

export default async function PaymentsPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const finance = await getFinanceOverview(session.organizationId);

  const formPatients = finance.patients.map((patient) => ({ id: patient.id, name: `${patient.firstName} ${patient.lastName}` }));
  const formTreatments = finance.treatments.map((treatment) => ({
    id: treatment.id,
    patientId: treatment.patientId,
    label: `${treatment.treatmentType} · ${treatment.patient.firstName} ${treatment.patient.lastName}`,
    fee: toNumber(treatment.fee)
  }));

  return (
    <div className="space-y-6">
      <ModuleHeader icon={CreditCard} title="Ödemeler" description="Hasta bazlı tahsilat, gider kaydı, vade ve yapılandırılmış sanal POS akışı." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Tahsil edilen" value={formatCurrency(finance.income, locale)} icon={WalletCards} tone="success" />
        <StatCard title="Kalan tahsilat" value={formatCurrency(finance.pending, locale)} icon={CreditCard} tone="warning" />
        <StatCard title="Toplam indirim" value={formatCurrency(finance.totalDiscount, locale)} icon={BadgePercent} tone="accent" />
        <StatCard title="Yaklaşan vade" value={String(finance.upcomingPayments.length)} icon={CalendarClock} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Ödeme / gider ekle</CardTitle></CardHeader>
          <CardContent>
            <PaymentForm action={createPaymentAction} patients={formPatients} treatments={formTreatments} locale={locale} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Yaklaşan tahsilatlar</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {finance.upcomingPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bekleyen tahsilat yok.</p>
            ) : (
              finance.upcomingPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{payment.patient ? `${payment.patient.firstName} ${payment.patient.lastName}` : "Klinik"}</p>
                    <p className="text-xs text-muted-foreground">
                      {payment.treatment ? `${payment.treatment.treatmentType} · ` : ""}
                      {payment.dueDate ? `vade: ${formatDate(payment.dueDate, locale)}` : "vade belirtilmedi"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(payment.amount, locale)}</p>
                    {payment.dueDate && new Date(payment.dueDate) < new Date() ? <Badge variant="danger">Gecikti</Badge> : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Hasta</TableHead>
                <TableHead>İşlem</TableHead>
                <TableHead>Referans</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Yöntem</TableHead>
                <TableHead>İndirim</TableHead>
                <TableHead>Aşama</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finance.payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{formatDate(payment.paidAt, locale)}</TableCell>
                  <TableCell>{payment.patient ? `${payment.patient.firstName} ${payment.patient.lastName}` : "Klinik"}</TableCell>
                  <TableCell>
                    {payment.treatment ? (
                      <div>
                        <span>{payment.treatment.treatmentType}</span>
                        <p className="text-xs text-muted-foreground">{formatCurrency(payment.treatment.fee, locale)}</p>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{payment.referralSource ?? "—"}</TableCell>
                  <TableCell>{statusLabel(payment.type, locale)}</TableCell>
                  <TableCell>{statusLabel(payment.method, locale)}</TableCell>
                  <TableCell>
                    {payment.discountAmount && toNumber(payment.discountAmount) > 0 ? (
                      <div>
                        <span className="text-emerald-600 dark:text-emerald-400">−{formatCurrency(payment.discountAmount, locale)}</span>
                        {payment.listAmount ? <p className="text-xs text-muted-foreground line-through">{formatCurrency(payment.listAmount, locale)}</p> : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{payment.isDeposit ? <Badge variant="warning">Peşinat</Badge> : "Normal ödeme"}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(payment.amount, locale)}</TableCell>
                  <TableCell>
                    <Badge variant={payment.status === "PAID" ? "success" : "warning"}>{statusLabel(payment.status, locale)}</Badge>
                    {payment.status === "PENDING" && payment.dueDate ? (
                      <p className="mt-1 text-xs text-muted-foreground">vade: {formatDate(payment.dueDate, locale)}</p>
                    ) : null}
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
