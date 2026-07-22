import { addClinicMonths, clinicDateKey, parseClinicDateKey } from "@/lib/clinic-time";
import { formatCurrency, formatDate } from "@/lib/utils";

export type Installment = {
  number: number;
  dueDate: string;
  amount: number;
};

export type TreatmentPaymentPlan = {
  total: number;
  downPayment: number;
  installmentCount: number;
  firstInstallmentDate: string | null;
  installments: Installment[];
  note?: string | null;
};

export function buildPaymentPlan(input: {
  total: number;
  downPayment?: number;
  installmentCount?: number;
  firstInstallmentDate?: string | null;
  note?: string | null;
}, now = new Date()): TreatmentPaymentPlan {
  const total = Math.max(0, Math.round(input.total * 100) / 100);
  const downPayment = Math.max(0, Math.round((input.downPayment ?? 0) * 100) / 100);
  const installmentCount = Math.max(1, Math.min(24, Math.trunc(input.installmentCount ?? 1)));
  const startDate = input.firstInstallmentDate ? parseClinicDateKey(input.firstInstallmentDate) : clinicDateKey(now);
  if (!startDate) throw new Error("İlk ödeme tarihi geçersiz.");
  const remaining = Math.max(0, Math.round((total - downPayment) * 100) / 100);
  const baseAmount = Math.floor((remaining / installmentCount) * 100) / 100;

  let allocated = 0;
  const installments = Array.from({ length: installmentCount }).map((_, index) => {
    const isLast = index === installmentCount - 1;
    const amount = isLast ? Math.round((remaining - allocated) * 100) / 100 : baseAmount;
    allocated += amount;
    return {
      number: index + 1,
      dueDate: addClinicMonths(startDate, index),
      amount
    };
  });

  return {
    total,
    downPayment,
    installmentCount,
    firstInstallmentDate: startDate,
    installments,
    note: input.note || null
  };
}

export function parsePaymentPlan(value: unknown): TreatmentPaymentPlan | null {
  if (!value || typeof value !== "object") return null;
  const plan = value as Partial<TreatmentPaymentPlan>;
  if (!Array.isArray(plan.installments)) return null;

  return {
    total: Number(plan.total ?? 0),
    downPayment: Number(plan.downPayment ?? 0),
    installmentCount: Number(plan.installmentCount ?? plan.installments.length),
    firstInstallmentDate: plan.firstInstallmentDate ?? null,
    installments: plan.installments.map((item) => ({
      number: Number(item.number),
      dueDate: String(item.dueDate),
      amount: Number(item.amount)
    })),
    note: plan.note ?? null
  };
}

export function summarizePaymentPlan(value: unknown) {
  const plan = parsePaymentPlan(value);
  if (!plan) return "Plan yok";

  if (plan.installmentCount <= 1 && plan.downPayment <= 0) {
    return `Tek ödeme · ${formatCurrency(plan.total)}`;
  }

  const firstInstallment = plan.installments[0];
  const firstAmount = firstInstallment ? formatCurrency(firstInstallment.amount) : formatCurrency(0);
  const firstDate = firstInstallment ? formatDate(firstInstallment.dueDate) : "-";

  return `${plan.downPayment > 0 ? `${formatCurrency(plan.downPayment)} peşinat · ` : ""}${plan.installmentCount} taksit · İlk: ${firstAmount} / ${firstDate}`;
}

export function paymentPlanLines(value: unknown) {
  const plan = parsePaymentPlan(value);
  if (!plan) return [];

  const downPaymentLine = plan.downPayment > 0 ? [`Peşinat: ${formatCurrency(plan.downPayment)}`] : [];
  const installmentLines = plan.installments.map((installment) => `${installment.number}. taksit: ${formatCurrency(installment.amount)} · ${formatDate(installment.dueDate)}`);

  return [...downPaymentLine, ...installmentLines];
}
