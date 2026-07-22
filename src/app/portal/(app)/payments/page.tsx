import { CalendarClock, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { requirePatientSession } from "@/lib/patient-auth";
import { getPatientPayments } from "@/lib/services/portalService";
import { formatCurrency, formatDate } from "@/lib/utils";
import { isClinicDateOverdue } from "@/lib/clinic-time";

export default async function PortalPaymentsPage() {
  const session = await requirePatientSession();
  const locale = await getLocale();
  const { payments, paidTotal, pendingTotal, upcoming } = await getPatientPayments(session);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Ödemelerim</h1>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Toplam ödenen</p>
            <p className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(paidTotal, locale)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Bekleyen ödeme</p>
            <p className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(pendingTotal, locale)}</p>
          </CardContent>
        </Card>
      </div>

      {upcoming.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" />
              Yaklaşan ödemeler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{payment.treatment?.treatmentType ?? "Genel ödeme"}</p>
                  <p className="text-xs text-muted-foreground">
                    {payment.dueDate ? `vade: ${formatDate(payment.dueDate, locale)}` : "vade belirtilmedi"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(payment.amount, locale)}</p>
                  {payment.dueDate && isClinicDateOverdue(payment.dueDate) ? <Badge variant="danger">Gecikti</Badge> : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-primary" />
            Ödeme geçmişi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ödeme kaydı bulunmuyor.</p>
          ) : (
            payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{payment.treatment?.treatmentType ?? "Genel ödeme"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(payment.paidAt, locale)} · {statusLabel(payment.method, locale)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(payment.amount, locale)}</p>
                  <Badge variant={payment.status === "PAID" ? "success" : payment.status === "PENDING" ? "warning" : "muted"}>
                    {statusLabel(payment.status, locale)}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
