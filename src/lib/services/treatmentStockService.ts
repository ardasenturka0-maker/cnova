import { AppointmentStatus, Prisma, StockMovementType, TreatmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
    where: { organizationId, branchId, treatmentKey: normalizeTreatmentKey(treatmentType) },
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
      where: { id: recipe.itemId, organizationId, branchId, currentQuantity: recipe.item.currentQuantity },
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
    const item = await tx.stockItem.findFirst({ where: { id: itemId, organizationId, branchId } });
    if (!item) continue;
    const updated = await tx.stockItem.updateMany({
      where: { id: item.id, organizationId, currentQuantity: item.currentQuantity },
      data: { currentQuantity: item.currentQuantity + quantity }
    });
    if (updated.count !== 1) throw new Error(`${item.name} stoğu aynı anda değişti. Lütfen işlemi yeniden deneyin.`);
    await tx.stockMovement.create({
      data: { itemId, type: StockMovementType.IN, quantity, note: `${label} geri alındı · otomatik iade`, organizationId, branchId, ...source }
    });
  }
}

export async function setTreatmentStatus(organizationId: string, treatmentId: string, status: TreatmentStatus) {
  return prisma.$transaction(async (tx) => {
    const treatment = await tx.treatment.findFirst({ where: { id: treatmentId, organizationId } });
    if (!treatment) throw new Error("Tedavi kaydı bulunamadı.");
    if (treatment.status === status) return treatment;

    if (status === TreatmentStatus.COMPLETED) {
      await consumeTreatmentRecipe(tx, organizationId, treatment.branchId, treatment.treatmentType, { treatmentId: treatment.id });
    } else if (treatment.status === TreatmentStatus.COMPLETED) {
      await releaseTreatmentRecipe(tx, organizationId, treatment.branchId, treatment.treatmentType, { treatmentId: treatment.id });
    }
    return tx.treatment.update({ where: { id: treatment.id }, data: { status } });
  });
}

export async function setAppointmentStatus(organizationId: string, appointmentId: string, status: AppointmentStatus) {
  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findFirst({ where: { id: appointmentId, organizationId } });
    if (!appointment) throw new Error("Randevu bulunamadı.");
    if (appointment.status === status) return appointment;

    if (status === AppointmentStatus.COMPLETED) {
      await consumeTreatmentRecipe(tx, organizationId, appointment.branchId, appointment.treatmentType, { appointmentId: appointment.id });
    } else if (appointment.status === AppointmentStatus.COMPLETED) {
      await releaseTreatmentRecipe(tx, organizationId, appointment.branchId, appointment.treatmentType, { appointmentId: appointment.id });
    }
    return tx.appointment.update({ where: { id: appointment.id }, data: { status } });
  });
}
