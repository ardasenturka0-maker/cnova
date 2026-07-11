import assert from "node:assert/strict";
import test from "node:test";
import { buildPaymentPlan, parsePaymentPlan } from "../src/lib/payment-plan";

test("payment plan preserves the exact remaining total", () => {
  const plan = buildPaymentPlan({
    total: 10_000,
    downPayment: 1_000,
    installmentCount: 7,
    firstInstallmentDate: "2026-08-15"
  });
  const installmentsTotal = plan.installments.reduce((sum, installment) => sum + installment.amount, 0);

  assert.equal(plan.installments.length, 7);
  assert.equal(Math.round(installmentsTotal * 100) / 100, 9_000);
  assert.equal(plan.installments[0]?.dueDate, "2026-08-15");
});

test("payment plan clamps unsafe values", () => {
  const plan = buildPaymentPlan({ total: -100, downPayment: -5, installmentCount: 99, firstInstallmentDate: "2026-01-01" });

  assert.equal(plan.total, 0);
  assert.equal(plan.downPayment, 0);
  assert.equal(plan.installmentCount, 24);
  assert.equal(plan.installments.every((installment) => installment.amount === 0), true);
});

test("invalid serialized payment plan is rejected", () => {
  assert.equal(parsePaymentPlan(null), null);
  assert.equal(parsePaymentPlan({ installments: "invalid" }), null);
});
