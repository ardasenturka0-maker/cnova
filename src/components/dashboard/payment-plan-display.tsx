import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/lib/i18n";
import { parsePaymentPlan } from "@/lib/payment-plan";
import { cn, formatCurrencyPrecise, formatDate } from "@/lib/utils";

export function PaymentPlanDisplay({ value, locale, compact = false }: { value: unknown; locale: Locale; compact?: boolean }) {
  const plan = parsePaymentPlan(value);
  if (!plan) return <span className="text-sm text-muted-foreground">Taksit planı yok</span>;
  const remaining = Math.max(plan.total - plan.downPayment, 0);

  return (
    <div className={cn("rounded-lg border bg-background", compact ? "min-w-64 p-3" : "p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Toplam / kalan plan</p>
          <p className="font-semibold">{formatCurrencyPrecise(plan.total, locale)} <span className="font-normal text-muted-foreground">/ {formatCurrencyPrecise(remaining, locale)}</span></p>
        </div>
        <Badge variant={plan.installmentCount > 1 ? "warning" : "muted"}>{plan.installmentCount > 1 ? `${plan.installmentCount} taksit` : "Tek ödeme"}</Badge>
      </div>
      {plan.downPayment > 0 ? <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">Peşinat: {formatCurrencyPrecise(plan.downPayment, locale)}</p> : null}
      <details className="mt-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-primary">
          <CalendarClock className="h-3.5 w-3.5" />Taksit takvimini göster
        </summary>
        <div className={cn("mt-2 grid gap-1.5", !compact && "sm:grid-cols-2 lg:grid-cols-3")}>
          {plan.installments.map((installment) => (
            <div key={installment.number} className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-2.5 py-2 text-xs">
              <span>{installment.number}. taksit · {formatDate(installment.dueDate, locale)}</span>
              <strong>{formatCurrencyPrecise(installment.amount, locale)}</strong>
            </div>
          ))}
        </div>
        {plan.note ? <p className="mt-2 rounded-md border-l-2 border-primary bg-muted/40 p-2 text-xs text-muted-foreground">{plan.note}</p> : null}
      </details>
    </div>
  );
}
