import { AppointmentStatus, Prisma, Role, StockMovementType, TreatmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertAppointmentAvailability, isActiveSchedulingStatus, withSerializableAppointmentTransaction, withSerializableTransaction } from "@/lib/services/appointmentAvailability";
import { parseClinicDateTime } from "@/lib/clinic-time";
import { buildPaymentPlan } from "@/lib/payment-plan";
import type { TreatmentInput } from "@/lib/validations/treatment";

type StockSource = { treatmentId: string; appointmentId?: never } | { appointmentId: string; treatmentId?: never };

export function normalizeTreatmentKey(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

function sourceWhere(source: StockSource) {
  return "treatmentId" in source ? { treatmentId: source.treatmentId } : { appointmentId: source.appointmentId };
}

export async function consumeTreatmentRecipe(
  tx: Prisma.TransactionClient,
  organizationId: string,
  branchId: string,
  treatmentType: string,
  source: StockSource
) {
  const existing = await tx.stockMovement.findMany({
    where: { organizationId, ...sourceWhere(source) },
    select: { itemId: true, type: true, quantity: true }
  });
  const outstanding = new Map<string, number>();
  for (const movement of existing) {
    const direction = movement.type === StockMovementType.OUT ? 1 : movement.type === StockMovementType.IN ? -1 : 0;
    outstanding.set(movement.itemId, (outstanding.get(movement.itemId) ?? 0) + direction * movement.quantity);
  }
  if ([...outstanding.values()].some((quantity) => quantity > 0)) return [];

  const recipes = await tx.stockRecipe.findMany({
    where: { organizationId, branchId, treatmentKey: normalizeTreatmentKey(treatmentType), item: { deletedAt: null } },
    include: { item: { select: { id: true, name: true, unit: true, currentQuantity: true } } },
    orderBy: { item: { name: "asc" } }
  });
  if (!recipes.length) return [];

  const insufficient = recipes.find((recipe) => recipe.item.currentQuantity < recipe.quantity);
  if (insufficient) {
    throw new Error(`Stok yetersiz: ${insufficient.item.name}. Gerekli ${insufficient.quantity} ${insufficient.item.unit}, mevcut ${insufficient.item.currentQuantity} ${insufficient.item.unit}.`);
  }

  for (const recipe of recipes) {
    const updated = await tx.stockItem.updateMany({
      where: { id: recipe.itemId, organizationId, branchId, deletedAt: null, currentQuantity: recipe.item.currentQuantity },
      data: { currentQuantity: recipe.item.currentQuantity - recipe.quantity }
    });
    if (updated.count !== 1) throw new Error(`${recipe.item.name} stoğu aynı anda değişti. Lütfen işlemi yeniden deneyin.`);
    await tx.stockMovement.create({
      data: {
        itemId: recipe.itemId,
        type: StockMovementType.OUT,
        quantity: recipe.quantity,
        note: `${treatmentType} tamamlandı · otomatik sarf`,
        organizationId,
        branchId,
        ...source
      }
    });
  }
  return recipes;
}

export async function releaseTreatmentRecipe(
  tx: Prisma.TransactionClient,
  organizationId: string,
  branchId: string,
  label: string,
  source: StockSource
) {
  const movements = await tx.stockMovement.findMany({
    where: { organizationId, ...sourceWhere(source) },
    select: { itemId: true, type: true, quantity: true }
  });
  const outstanding = new Map<string, number>();
  for (const movement of movements) {
    const direction = movement.type === StockMovementType.OUT ? 1 : movement.type === StockMovementType.IN ? -1 : 0;
    outstanding.set(movement.itemId, (outstanding.get(movement.itemId) ?? 0) + direction * movement.quantity);
  }

  for (const [itemId, quantity] of outstanding) {
    if (quantity <= 0) continue;
    // A treatment can be cancelled after one of its consumed stock items was moved
    // to trash. Keep the hidden item's quantity and movement ledger consistent so
    // restoring it later cannot resurrect an already-consumed amount.
    const item = await tx.stockItem.findFirst({ where: { id: itemId, organizationId, branchId } });
    if (!item) continue;
    const updated = await tx.stockItem.updateMany({
      where: { id: item.id, organizationId, branchId, currentQuantity: item.currentQuantity },
      data: { currentQuantity: item.currentQuantity + quantity }
    });
    if (updated.count !== 1) throw new Error(`${item.name} stoğu aynı anda değişti. Lütfen işlemi yeniden deneyin.`);
    await tx.stockMovement.create({
      data: { itemId, type: StockMovementType.IN, quantity, note: `${label} geri alındı · otomatik iade`, organizationId, branchId, ...source }
    });
  }
}

export async function setTreatmentStatus(organizationId: string, treatmentId: string, status: TreatmentStatus) {
  return withSerializableTransaction(async (tx) => {
    const treatment = await tx.treatment.findFirst({ where: { id: treatmentId, organizationId, patient: { deletedAt: null } } });
    if (!treatment) throw new Error("Tedavi kaydı bulunamadı.");
    if (treatment.status === status) return treatment;

    if (status === TreatmentStatus.COMPLETED) {
      await consumeTreatmentRecipe(tx, organizationId, treatment.branchId, treatment.treatmentType, { treatmentId: treatment.id });
    } else if (treatment.status === TreatmentStatus.COMPLETED) {
      await releaseTreatmentRecipe(tx, organizationId, treatment.branchId, treatment.treatmentType, { treatmentId: treatment.id });
    }
    const updated = await tx.treatment.updateMany({
      where: { id: treatment.id, organizationId, status: treatment.status, patient: { deletedAt: null } },
      data: { status }
    });
    if (updated.count !== 1) throw new Error("Tedavi durumu aynı anda değiştirildi. Lütfen yeniden deneyin.");
    return tx.treatment.findUniqueOrThrow({ where: { id: treatment.id } });
  }, "Tedavi aynı anda değiştirildi. Lütfen yeniden deneyin.");
}

/**
 * Updates a treatment and reconciles its automatic stock recipe in the same
 * serializable transaction. Patient reassignment is intentionally rejected:
 * payments and clinical history already linked to a treatment must never move
 * to another patient's file as a side effect of editing a form.
 */
export async function updateTreatmentRecord(organizationId: string, treatmentId: string, input: TreatmentInput) {
  return withSerializableTransaction(async (tx) => {
    const treatment = await tx.treatment.findFirst({
      where: { id: treatmentId, organizationId, patient: { deletedAt: null } }
    });
    if (!treatment) throw new Error("Tedavi kaydı bulunamadı.");
    if (treatment.patientId !== input.patientId) throw new Error("Kaydedilmiş bir tedavi başka bir hastaya taşınamaz.");

    const patient = await tx.patient.findFirst({
      where: { id: treatment.patientId, organizationId, branchId: treatment.branchId, deletedAt: null },
      select: { id: true, branchId: true }
    });
    if (!patient) throw new Error("Tedavinin hastası bulunamadı.");
    const doctor = await tx.user.findFirst({
      where: {
        id: input.doctorId,
        organizationId,
        active: true,
        role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] },
        OR: [{ branchId: patient.branchId }, { branchId: null }]
      },
      select: { id: true }
    });
    if (!doctor) throw new Error("Seçilen doktor aktif değil veya hastanın şubesinde çalışmıyor.");

    const nextStatus = input.status as TreatmentStatus;
    const recipeChanged = normalizeTreatmentKey(treatment.treatmentType) !== normalizeTreatmentKey(input.treatmentType);
    if (treatment.status === TreatmentStatus.COMPLETED && (nextStatus !== TreatmentStatus.COMPLETED || recipeChanged)) {
      await releaseTreatmentRecipe(tx, organizationId, treatment.branchId, treatment.treatmentType, { treatmentId: treatment.id });
    }
    if (nextStatus === TreatmentStatus.COMPLETED && (treatment.status !== TreatmentStatus.COMPLETED || recipeChanged)) {
      await consumeTreatmentRecipe(tx, organizationId, treatment.branchId, input.treatmentType, { treatmentId: treatment.id });
    }

    const performedAt = input.date ? parseClinicDateTime(`${input.date}T12:00`) : treatment.performedAt;
    if (!performedAt) throw new Error("Tedavi tarihi geçersiz.");
    const paymentPlan = buildPaymentPlan({
      total: input.fee,
      downPayment: input.downPayment,
      installmentCount: input.installmentCount,
      firstInstallmentDate: input.firstInstallmentDate || null,
      note: input.paymentPlanNote || null
    });
    const updated = await tx.treatment.updateMany({
      where: { id: treatment.id, organizationId, status: treatment.status, updatedAt: treatment.updatedAt, patient: { deletedAt: null } },
      data: {
        doctorId: doctor.id,
        toothNumber: input.toothNumber || null,
        treatmentType: input.treatmentType,
        description: input.description || null,
        fee: input.fee,
        paymentPlan: paymentPlan as unknown as Prisma.InputJsonValue,
        status: nextStatus,
        performedAt
      }
    });
    if (updated.count !== 1) throw new Error("Tedavi aynı anda değiştirildi. Lütfen yeniden deneyin.");
    return tx.treatment.findUniqueOrThrow({ where: { id: treatment.id } });
  }, "Tedavi aynı anda değiştirildi. Lütfen yeniden deneyin.");
}

export async function setAppointmentStatus(organizationId: string, appointmentId: string, status: AppointmentStatus) {
  return withSerializableAppointmentTransaction(async (tx) => {
    const appointment = await tx.appointment.findFirst({ where: { id: appointmentId, organizationId, patient: { deletedAt: null } } });
    if (!appointment) throw new Error("Randevu bulunamadı.");
    if (appointment.status === status) return appointment;

    if (!isActiveSchedulingStatus(appointment.status) && isActiveSchedulingStatus(status)) {
      const doctor = await tx.user.findFirst({
        where: {
          id: appointment.doctorId,
          organizationId,
          active: true,
          role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] },
          OR: [{ branchId: appointment.branchId }, { branchId: null }]
        },
        select: { id: true }
      });
      if (!doctor) throw new Error("Randevunun doktoru artık aktif değil veya bu şubede çalışmıyor.");
      await assertAppointmentAvailability(tx, {
        organizationId,
        branchId: appointment.branchId,
        doctorId: appointment.doctorId,
        startsAt: appointment.startsAt,
        durationMinutes: appointment.durationMinutes,
        room: appointment.room,
        excludeAppointmentId: appointment.id
      });
    }

    if (status === AppointmentStatus.COMPLETED) {
      await consumeTreatmentRecipe(tx, organizationId, appointment.branchId, appointment.treatmentType, { appointmentId: appointment.id });
    } else if (appointment.status === AppointmentStatus.COMPLETED) {
      await releaseTreatmentRecipe(tx, organizationId, appointment.branchId, appointment.treatmentType, { appointmentId: appointment.id });
    }
    const updated = await tx.appointment.updateMany({
      where: { id: appointment.id, organizationId, status: appointment.status, patient: { deletedAt: null } },
      data: { status }
    });
    if (updated.count !== 1) throw new Error("Randevu durumu aynı anda değiştirildi. Lütfen yeniden deneyin.");
    return tx.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
  });
}
