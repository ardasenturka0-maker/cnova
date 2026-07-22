import { Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stockItemSchema, stockMovementSchema, stockOfferSchema, stockRecipeSchema } from "@/lib/validations/stock";
import { normalizeTreatmentKey } from "@/lib/services/treatmentStockService";
import type { z } from "zod";

type StockItemInput = z.infer<typeof stockItemSchema>;
type StockMovementInput = z.infer<typeof stockMovementSchema>;
type StockOfferInput = z.infer<typeof stockOfferSchema>;
type StockRecipeInput = z.infer<typeof stockRecipeSchema>;

function branchScope(branchId?: string | null) {
  return branchId ? { branchId } : {};
}

export async function applyStockQuantityChange(
  tx: Pick<Prisma.TransactionClient, "stockItem">,
  input: { organizationId: string; itemId: string; branchId?: string; type: StockMovementType; quantity: number }
) {
  const scope = { id: input.itemId, organizationId: input.organizationId, deletedAt: null, ...(input.branchId ? { branchId: input.branchId } : {}) };
  const item = await tx.stockItem.findFirst({ where: scope });
  if (!item) throw new Error("Stok kalemi bulunamadi.");

  if (input.type === StockMovementType.OUT) {
    const updated = await tx.stockItem.updateMany({
      where: { ...scope, currentQuantity: { gte: input.quantity } },
      data: { currentQuantity: { decrement: input.quantity } }
    });
    if (updated.count !== 1) {
      const current = await tx.stockItem.findFirst({ where: scope, select: { currentQuantity: true } });
      if (!current) throw new Error("Stok kalemi bulunamadi.");
      throw new Error(`Stok yetersiz. Mevcut miktar: ${current.currentQuantity}.`);
    }
  } else if (input.type === StockMovementType.IN) {
    const updated = await tx.stockItem.updateMany({ where: scope, data: { currentQuantity: { increment: input.quantity } } });
    if (updated.count !== 1) throw new Error("Stok kalemi aynı anda silindi. Lütfen yeniden deneyin.");
  } else {
    const updated = await tx.stockItem.updateMany({ where: scope, data: { currentQuantity: input.quantity } });
    if (updated.count !== 1) throw new Error("Stok kalemi aynı anda silindi. Lütfen yeniden deneyin.");
  }
  return item;
}

export async function getStocks(organizationId: string, branchId?: string | null) {
  const items = await prisma.stockItem.findMany({
    where: { organizationId, ...branchScope(branchId), deletedAt: null },
    include: {
      branch: { select: { name: true } },
      movements: { orderBy: { movedAt: "desc" }, take: 5 },
      offers: { orderBy: [{ inStock: "desc" }, { unitPrice: "asc" }] }
    },
    orderBy: [{ currentQuantity: "asc" }, { name: "asc" }]
  });
  return items.map((item) => ({
    ...item,
    offers: [...item.offers].sort((left, right) => {
      if (left.inStock !== right.inStock) return left.inStock ? -1 : 1;
      return Number(left.unitPrice) + Number(left.shippingPrice) - Number(right.unitPrice) - Number(right.shippingPrice);
    })
  }));
}

export async function getStockRecipes(organizationId: string, branchId?: string | null) {
  return prisma.stockRecipe.findMany({
    where: { organizationId, ...branchScope(branchId), item: { deletedAt: null } },
    include: { item: { select: { name: true, unit: true } }, branch: { select: { name: true } } },
    orderBy: { treatmentType: "asc" }
  });
}

export async function createStockRecipe(organizationId: string, branchId: string, input: StockRecipeInput) {
  const item = await prisma.stockItem.findFirst({ where: { id: input.itemId, organizationId, branchId, deletedAt: null }, select: { id: true } });
  if (!item) throw new Error("Seçilen stok ürünü bu şubede bulunamadı.");
  const treatmentKey = normalizeTreatmentKey(input.treatmentType);
  const existing = await prisma.stockRecipe.findFirst({ where: { organizationId, branchId, treatmentKey, itemId: item.id }, select: { id: true } });
  if (existing) return prisma.stockRecipe.update({ where: { id: existing.id }, data: { treatmentType: input.treatmentType.trim(), quantity: input.quantity } });
  return prisma.stockRecipe.create({ data: { organizationId, branchId, treatmentKey, treatmentType: input.treatmentType.trim(), itemId: item.id, quantity: input.quantity } });
}

export async function deleteStockRecipe(organizationId: string, recipeId: string, branchId?: string | null) {
  const result = await prisma.stockRecipe.deleteMany({ where: { id: recipeId, organizationId, ...branchScope(branchId) } });
  if (result.count !== 1) throw new Error("Malzeme reçetesi bulunamadı.");
}

export async function createStockOffer(organizationId: string, branchId: string, input: StockOfferInput) {
  const item = await prisma.stockItem.findFirst({ where: { id: input.itemId, organizationId, branchId, deletedAt: null }, select: { id: true, branchId: true } });
  if (!item) throw new Error("Stok kalemi bulunamadı.");
  return prisma.stockOffer.create({
    data: {
      itemId: item.id,
      seller: input.seller,
      unitPrice: input.unitPrice,
      shippingPrice: input.shippingPrice,
      productUrl: input.productUrl,
      inStock: input.inStock,
      checkedAt: new Date(),
      organizationId,
      branchId: item.branchId || branchId
    }
  });
}

export async function createStockItem(organizationId: string, branchId: string, input: StockItemInput) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.stockItem.create({
      data: {
        name: input.name,
        category: input.category,
        currentQuantity: input.currentQuantity,
        minimumQuantity: input.minimumQuantity,
        unit: input.unit,
        supplier: input.supplier || null,
        purchasePrice: input.purchasePrice,
        organizationId,
        branchId
      }
    });
    if (input.currentQuantity > 0) {
      await tx.stockMovement.create({
        data: { itemId: item.id, type: StockMovementType.IN, quantity: input.currentQuantity, note: "Açılış stoku", organizationId, branchId }
      });
    }
    return item;
  });
}

export async function createStockMovement(organizationId: string, branchId: string, input: StockMovementInput) {
  return prisma.$transaction(async (tx) => {
    const type = input.type as StockMovementType;
    const item = await applyStockQuantityChange(tx, { organizationId, branchId, itemId: input.itemId, type, quantity: input.quantity });

    return tx.stockMovement.create({
      data: {
        itemId: item.id,
        type,
        quantity: input.quantity,
        note: input.note || null,
        organizationId,
        branchId: item.branchId || branchId
      }
    });
  });
}

const STOCK_TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function stockTrashPurgeAt(now: Date) {
  return new Date(now.getTime() + STOCK_TRASH_RETENTION_MS);
}

export async function softDeleteStockItem(organizationId: string, itemId: string, userId: string, branchId?: string | null) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.stockItem.findFirst({
      where: { id: itemId, organizationId, ...branchScope(branchId), deletedAt: null },
      select: { id: true, branchId: true, name: true }
    });
    if (!item) throw new Error("Stok kalemi bulunamadı veya daha önce silinmiş.");

    const now = new Date();
    const purgeAt = stockTrashPurgeAt(now);
    const result = await tx.stockItem.updateMany({
      where: { id: item.id, organizationId, branchId: item.branchId, deletedAt: null },
      data: { deletedAt: now, purgeAt, deletedById: userId, restoredAt: null, restoredById: null }
    });
    if (result.count !== 1) throw new Error("Stok kalemi aynı anda değiştirildi. Lütfen yeniden deneyin.");

    await tx.auditLog.create({
      data: {
        userId,
        action: "SOFT_DELETE_STOCK_ITEM",
        module: "stocks",
        entityId: item.id,
        metadata: { name: item.name, purgeAt: purgeAt.toISOString() },
        organizationId,
        branchId: item.branchId
      }
    });
    return { ...result, purgeAt };
  });
}

export async function getDeletedStockItems(
  organizationId: string,
  options: { page?: number; pageSize?: number; branchId?: string | null } = {}
) {
  const now = new Date();
  const requestedPage = Number.isSafeInteger(options.page) && (options.page ?? 0) > 0 ? options.page! : 1;
  const pageSize = Number.isSafeInteger(options.pageSize) && (options.pageSize ?? 0) > 0
    ? Math.min(options.pageSize!, 100)
    : 50;
  const where = { organizationId, ...branchScope(options.branchId), deletedAt: { not: null }, purgeAt: { gt: now } } satisfies Prisma.StockItemWhereInput;

  return prisma.$transaction(async (tx) => {
    const total = await tx.stockItem.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const items = await tx.stockItem.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        recipes: { orderBy: { treatmentType: "asc" } },
        offers: { orderBy: { checkedAt: "desc" } },
        movements: { orderBy: { movedAt: "desc" }, take: 10 }
      },
      orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    return { items, total, page, pageSize, totalPages };
  });
}

export async function restoreStockItem(organizationId: string, itemId: string, userId: string, branchId?: string | null) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const item = await tx.stockItem.findFirst({
      where: { id: itemId, organizationId, ...branchScope(branchId), deletedAt: { not: null }, purgeAt: { gt: now } },
      select: { id: true, branchId: true, name: true }
    });
    if (!item) throw new Error("Stok kalemi çöp kutusunda bulunamadı veya geri yükleme süresi dolmuş.");

    const result = await tx.stockItem.updateMany({
      where: { id: item.id, organizationId, branchId: item.branchId, deletedAt: { not: null }, purgeAt: { gt: now } },
      data: { deletedAt: null, purgeAt: null, restoredAt: now, restoredById: userId }
    });
    if (result.count !== 1) throw new Error("Stok kalemi aynı anda değiştirildi. Lütfen yeniden deneyin.");

    await tx.auditLog.create({
      data: {
        userId,
        action: "RESTORE_STOCK_ITEM",
        module: "stocks",
        entityId: item.id,
        metadata: { name: item.name },
        organizationId,
        branchId: item.branchId
      }
    });
    return result;
  });
}
