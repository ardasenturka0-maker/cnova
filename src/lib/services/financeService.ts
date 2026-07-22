import { PaymentMethod, PaymentStatus, PaymentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import type { PaymentInput } from "@/lib/validations/finance";
import { parseClinicDateTime } from "@/lib/clinic-time";

function clinicCalendarDate(value: string) {
  const parsed = parseClinicDateTime(`${value}T12:00`);
  if (!parsed) throw new Error("Ödeme tarihi geçersiz.");
  return parsed;
}

export async function getFinanceOverview(organizationId: string) {
  const [payments, invoices, patients, treatments] = await Promise.all([
    prisma.payment.findMany({
      where: { organizationId, OR: [{ patientId: null }, { patient: { deletedAt: null } }] },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        treatment: { select: { treatmentType: true, fee: true } },
        branch: { select: { name: true } }
      },
      orderBy: { paidAt: "desc" },
      take: 80
    }),
    prisma.invoice.findMany({
      where: { organizationId, OR: [{ patientId: null }, { patient: { deletedAt: null } }] },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 80
    }),
    prisma.patient.findMany({ where: { organizationId, deletedAt: null }, orderBy: { firstName: "asc" }, take: 200 }),
    prisma.treatment.findMany({
      where: { organizationId, patient: { deletedAt: null } },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { performedAt: "desc" },
      take: 100
    })
  ]);

  const income = payments.filter((payment) => payment.type === PaymentType.INCOME && payment.status === PaymentStatus.PAID).reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const pending = payments.filter((payment) => payment.type === PaymentType.INCOME && payment.status === PaymentStatus.PENDING).reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const expenses = payments.filter((payment) => payment.type === PaymentType.EXPENSE && payment.status === PaymentStatus.PAID).reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const totalDiscount = payments
    .filter((payment) => payment.type === PaymentType.INCOME && payment.status !== PaymentStatus.CANCELLED)
    .reduce((sum, payment) => sum + toNumber(payment.discountAmount ?? 0), 0);
  const upcomingPayments = payments
    .filter((payment) => payment.type === PaymentType.INCOME && payment.status === PaymentStatus.PENDING)
    .sort((a, b) => {
      const left = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return left - right;
    })
    .slice(0, 6);

  return { payments, invoices, patients, treatments, income, pending, expenses, totalDiscount, upcomingPayments, net: income - expenses };
}

export async function createPayment(organizationId: string, fallbackBranchId: string, input: PaymentInput) {
  const [patient, treatment] = await Promise.all([
    input.patientId
      ? prisma.patient.findFirst({ where: { id: input.patientId, organizationId, deletedAt: null }, select: { id: true, branchId: true } })
      : null,
    input.treatmentId
      ? prisma.treatment.findFirst({ where: { id: input.treatmentId, organizationId, patient: { deletedAt: null } }, select: { id: true, patientId: true, branchId: true, fee: true } })
      : null
  ]);

  const listAmount = typeof input.listAmount === "number" ? input.listAmount : treatment ? toNumber(treatment.fee) : null;
  const discountAmount = typeof input.discountAmount === "number" ? input.discountAmount : null;
  if (input.patientId && !patient) throw new Error("Seçilen hasta bulunamadı veya bu kliniğe ait değil.");
  if (input.treatmentId && !treatment) throw new Error("Seçilen tedavi bulunamadı veya bu kliniğe ait değil.");
  if (patient && treatment && patient.id !== treatment.patientId) throw new Error("Seçilen tedavi bu hastaya ait değil.");
  if (input.isDeposit && input.type !== "INCOME") throw new Error("Gider kaydı peşinat olarak işaretlenemez.");
  if (input.isDeposit && !patient && !treatment) throw new Error("Peşinat için hasta veya tedavi seçilmelidir.");
  if (discountAmount !== null && listAmount === null) throw new Error("İndirim için liste fiyatı veya tedavi seçilmelidir.");
  if (listAmount !== null && discountAmount !== null && discountAmount > listAmount) throw new Error("İndirim liste fiyatından büyük olamaz.");
  const finalAmount = listAmount === null ? null : Math.max(0, listAmount - (discountAmount ?? 0));
  if (input.type === "INCOME" && finalAmount !== null && input.amount > finalAmount) {
    throw new Error("Tahsilat tutarı indirim sonrası son tutardan büyük olamaz.");
  }

  return prisma.payment.create({
    data: {
      patientId: patient?.id ?? treatment?.patientId ?? null,
      treatmentId: treatment?.id ?? null,
      type: input.type as PaymentType,
      amount: input.amount,
      listAmount,
      discountAmount,
      isDeposit: input.isDeposit,
      referralSource: input.referralSource || null,
      method: input.method as PaymentMethod,
      description: input.description || null,
      status: input.status as PaymentStatus,
      paidAt: input.paidAt ? clinicCalendarDate(input.paidAt) : new Date(),
      dueDate: input.dueDate ? clinicCalendarDate(input.dueDate) : null,
      organizationId,
      branchId: patient?.branchId ?? treatment?.branchId ?? fallbackBranchId
    }
  });
}
