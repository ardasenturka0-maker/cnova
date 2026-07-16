import { StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stockItemSchema, stockMovementSchema, stockOfferSchema, stockRecipeSchema } from "@/lib/validations/stock";
import { normalizeTreatmentKey } from "@/lib/services/treatmentStockService";
import type { z } from "zod";

type StockItemInput = z.infer<typeof stockItemSchema>;
type StockMovementInput = z.infer<typeof stockMovementSchema>;
type StockOfferInput = z.infer<typeof stockOfferSchema>;
type StockRecipeInput = z.infer<typeof stockRecipeSchema>;

export async function getStocks(organizationId: string) {
  const items = await prisma.stockItem.findMany({
    where: { organizationId },
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

export async function getStockRecipes(organizationId: string) {
  return prisma.stockRecipe.findMany({
    where: { organizationId },
    include: { item: { select: { name: true, unit: true } }, branch: { select: { name: true } } },
    orderBy: { treatmentType: "asc" }
  });
}

export async function createStockRecipe(organizationId: string, branchId: string, input: StockRecipeInput) {
  const item = await prisma.stockItem.findFirst({ where: { id: input.itemId, organizationId, branchId }, select: { id: true } });
  if (!item) throw new Error("Seçilen stok ürünü bu şubede bulunamadı.");
  const treatmentKey = normalizeTreatmentKey(input.treatmentType);
  const existing = await prisma.stockRecipe.findFirst({ where: { organizationId, branchId, treatmentKey, itemId: item.id }, select: { id: true } });
  if (existing) return prisma.stockRecipe.update({ where: { id: existing.id }, data: { treatmentType: input.treatmentType.trim(), quantity: input.quantity } });
  return prisma.stockRecipe.create({ data: { organizationId, branchId, treatmentKey, treatmentType: input.treatmentType.trim(), itemId: item.id, quantity: input.quantity } });
}

export async function deleteStockRecipe(organizationId: string, recipeId: string) {
  const result = await prisma.stockRecipe.deleteMany({ where: { id: recipeId, organizationId } });
  if (result.count !== 1) throw new Error("Malzeme reçetesi bulunamadı.");
}

export async function createStockOffer(organizationId: string, branchId: string, input: StockOfferInput) {
  const item = await prisma.stockItem.findFirst({ where: { id: input.itemId, organizationId }, select: { id: true, branchId: true } });
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
    const item = await tx.stockItem.findFirst({ where: { id: input.itemId, organizationId } });
    if (!item) {
      throw new Error("Stok kalemi bulunamadi.");
    }

    const type = input.type as StockMovementType;
    if (type === StockMovementType.OUT && input.quantity > item.currentQuantity) {
      throw new Error(`Stok yetersiz. Mevcut miktar: ${item.currentQuantity}.`);
    }
    const nextQuantity =
      type === StockMovementType.IN
        ? item.currentQuantity + input.quantity
        : type === StockMovementType.OUT
          ? item.currentQuantity - input.quantity
          : input.quantity;

    await tx.stockItem.update({
      where: { id: item.id },
      data: { currentQuantity: nextQuantity }
    });

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
