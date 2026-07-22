"use client";

import { CalendarClock, CircleDollarSign, CreditCard, WalletCards } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/lib/i18n";
import { buildPaymentPlan } from "@/lib/payment-plan";
import { cn, formatCurrencyPrecise, formatDate } from "@/lib/utils";

const installmentOptions = [1, 2, 3, 4, 6, 9, 12, 18, 24];

function numeric(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function PaymentPlanBuilder({
  totalName,
  totalLabel,
  today,
  locale,
  initialTotal = 0,
  initialDownPayment = 0,
  initialInstallmentCount = 1,
  initialFirstInstallmentDate = "",
  initialNote = "",
  idPrefix
}: {
  totalName: "fee" | "estimatedFee";
  totalLabel: string;
  today: string;
  locale: Locale;
  initialTotal?: number;
  initialDownPayment?: number;
  initialInstallmentCount?: number;
  initialFirstInstallmentDate?: string;
  initialNote?: string;
  idPrefix?: string;
}) {
  const generatedId = useId();
  const fieldId = idPrefix ?? `${totalName}-${generatedId}`;
  const [total, setTotal] = useState(String(initialTotal));
  const [downPayment, setDownPayment] = useState(String(initialDownPayment));
  const [installmentCount, setInstallmentCount] = useState(initialInstallmentCount);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(initialFirstInstallmentDate);
  const totalValue = numeric(total);
  const downPaymentValue = numeric(downPayment);
  const downPaymentTooHigh = downPaymentValue > totalValue;
  const plan = useMemo(() => buildPaymentPlan({
    total: totalValue,
    downPayment: Math.min(downPaymentValue, totalValue),
    installmentCount,
    firstInstallmentDate: firstInstallmentDate || today
  }), [downPaymentValue, firstInstallmentDate, installmentCount, today, totalValue]);
  const remaining = Math.max(totalValue - downPaymentValue, 0);

  return (
    <fieldset className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.025] p-4 lg:col-span-4">
      <legend className="px-2 text-sm font-semibold text-primary">Tahsilat ve taksit planı</legend>
      <p className="text-sm text-muted-foreground">Toplam bedeli, alınan peşinatı ve kalan tutarın kaç taksitte tahsil edileceğini sırayla belirleyin.</p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-amount`}><span className="mr-1 text-primary">1.</span>{totalLabel}</Label>
          <Input id={`${fieldId}-amount`} name={totalName} type="number" min="0" step="0.01" required value={total} onChange={(event) => setTotal(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-down-payment`}><span className="mr-1 text-primary">2.</span>Alınan peşinat</Label>
          <Input
            id={`${fieldId}-down-payment`}
            name="downPayment"
            type="number"
            min="0"
            max={totalValue || undefined}
            step="0.01"
            value={downPayment}
            aria-invalid={downPaymentTooHigh}
            onChange={(event) => setDownPayment(event.target.value)}
          />
          {downPaymentTooHigh ? <p className="text-xs font-medium text-destructive">Peşinat toplam bedelden büyük olamaz.</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-installments`}><span className="mr-1 text-primary">3.</span>Kalan tutarın taksiti</Label>
          <Select id={`${fieldId}-installments`} name="installmentCount" value={String(installmentCount)} onChange={(event) => setInstallmentCount(Number(event.target.value))}>
            {installmentOptions.map((count) => <option key={count} value={count}>{count === 1 ? "Tek ödeme" : `${count} aylık taksit`}</option>)}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-first-date`}><span className="mr-1 text-primary">4.</span>İlk ödeme tarihi</Label>
          <Input id={`${fieldId}-first-date`} name="firstInstallmentDate" type="date" value={firstInstallmentDate} onChange={(event) => setFirstInstallmentDate(event.target.value)} />
          <p className="text-xs text-muted-foreground">Boş bırakılırsa bugün ({formatDate(today, locale)}).</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-background p-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><CircleDollarSign className="h-3.5 w-3.5" />Toplam tedavi bedeli</p>
          <p className="mt-1 text-lg font-semibold">{formatCurrencyPrecise(totalValue, locale)}</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><WalletCards className="h-3.5 w-3.5" />Peşinat</p>
          <p className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrencyPrecise(Math.min(downPaymentValue, totalValue), locale)}</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><CreditCard className="h-3.5 w-3.5" />Taksitlenecek bakiye</p>
          <p className="mt-1 text-lg font-semibold">{formatCurrencyPrecise(remaining, locale)}</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />Plan</p>
          <p className="mt-1 text-lg font-semibold">{installmentCount} × {formatCurrencyPrecise(plan.installments[0]?.amount ?? 0, locale)}</p>
          {plan.installments.length > 1 && plan.installments.at(-1)?.amount !== plan.installments[0]?.amount ? <p className="text-xs text-muted-foreground">Son taksit: {formatCurrencyPrecise(plan.installments.at(-1)?.amount ?? 0, locale)}</p> : null}
        </div>
      </div>

      {totalValue > 0 ? (
        <div className="rounded-lg border bg-background p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Taksit takvimi</p>
            <span className="text-xs text-muted-foreground">Toplam {formatCurrencyPrecise(plan.installments.reduce((sum, installment) => sum + installment.amount, 0), locale)}</span>
          </div>
          <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-3", plan.installments.length > 9 && "max-h-64 overflow-y-auto pr-1")}>
            {plan.installments.map((installment) => (
              <div key={installment.number} className="flex items-center justify-between gap-3 rounded-md bg-muted/55 px-3 py-2 text-sm">
                <span><strong>{installment.number}. taksit</strong><small className="ml-1 text-muted-foreground">{formatDate(installment.dueDate, locale)}</small></span>
                <span className="font-semibold">{formatCurrencyPrecise(installment.amount, locale)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Taksit takvimini görmek için toplam tedavi bedelini girin.</p>}

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-payment-note`}>Tahsilat planı notu</Label>
        <Textarea id={`${fieldId}-payment-note`} name="paymentPlanNote" maxLength={500} defaultValue={initialNote} placeholder="Örn. Peşinat nakit, kalan taksitler her ayın 15'inde kartla alınacak." />
      </div>
    </fieldset>
  );
}
