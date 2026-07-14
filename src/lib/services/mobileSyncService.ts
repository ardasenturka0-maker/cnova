import { createHash } from "node:crypto";
import { AppointmentStatus, PaymentMethod, PaymentStatus, PaymentType, Prisma, Role, StockMovementType, TreatmentStatus } from "@prisma/client";
import { z } from "zod";
import type { AuthSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getWritableBranchId } from "@/lib/services/tenantService";
import type { MobileSyncBatch, MobileSyncOperation } from "@/lib/validations/mobile-sync";

const patientPayload = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(8).max(40),
  email: z.string().email().or(z.literal("")).optional(),
  tag: z.enum(["NEW", "ACTIVE", "PASSIVE", "RISKY", "VIP"]).default("NEW"),
  treatment: z.string().max(160).optional(),
  note: z.string().max(4000).optional()
});

const appointmentPayload = z.object({
  patientId: z.union([z.string(), z.number()]).transform(String),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.coerce.number().int().min(15).max(240),
  treatment: z.string().trim().min(2).max(200),
  doctor: z.string().trim().max(160).optional(),
  room: z.string().max(80).optional(),
  status: z.enum(["PLANNED", "ARRIVED", "NO_SHOW", "CANCELLED", "COMPLETED"]).default("PLANNED")
});

const paymentPayload = z.object({
  patientId: z.union([z.string(), z.number()]).transform(String),
  amount: z.coerce.number().positive().max(100_000_000),
  totalAmount: z.coerce.number().positive().max(100_000_000).optional(),
  remainingAmount: z.coerce.number().min(0).max(100_000_000).optional(),
  method: z.string().max(40).optional(),
  description: z.string().max(1000).optional(),
  detail: z.string().max(1000).optional(),
  isDeposit: z.boolean().optional()
});

const stockItemPayload = z.object({
  name: z.string().trim().min(2).max(200), category: z.string().trim().min(2).max(120),
  currentQuantity: z.coerce.number().int().min(0), minimumQuantity: z.coerce.number().int().min(0),
  unit: z.string().trim().min(1).max(40), supplier: z.string().trim().max(200).optional(), purchasePrice: z.coerce.number().min(0).max(100_000_000)
});

const treatmentPlanPayload = z.object({
  patientId: z.union([z.string(), z.number()]).transform(String), doctor: z.string().trim().min(2).max(160),
  toothNumber: z.string().trim().max(40).optional(), treatmentType: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(), estimatedFee: z.coerce.number().min(0).max(100_000_000),
  status: z.enum(["PROPOSED", "ACCEPTED", "STARTED", "COMPLETED", "CANCELLED"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const stockMovementPayload = z.object({
  itemId: z.union([z.string(), z.number()]).transform(String), type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().int().min(0), note: z.string().trim().max(500).optional()
}).refine((value) => value.type === "ADJUSTMENT" || value.quantity > 0, { message: "Stok giriş ve çıkış miktarı sıfırdan büyük olmalıdır.", path: ["quantity"] });

const stockOfferPayload = z.object({
  itemId: z.union([z.string(), z.number()]).transform(String), seller: z.string().trim().min(2).max(200),
  unitPrice: z.coerce.number().positive().max(100_000_000), shippingPrice: z.coerce.number().min(0).max(100_000_000),
  productUrl: z.string().url().refine((url) => url.startsWith("https://"), "Yalnızca HTTPS ürün adresi kullanılabilir."), inStock: z.boolean().default(true)
});

type SyncResult = { operationId: string; status: "synced" | "failed"; serverEntityId?: string; error?: string };

function payloadHash(operation: MobileSyncOperation) {
  return createHash("sha256").update(JSON.stringify({ entityType: operation.entityType, action: operation.action, clientId: operation.clientId, payload: operation.payload })).digest("hex");
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts.shift()!, lastName: parts.join(" ") || "Hasta" };
}

function paymentMethod(value?: string) {
  const normalized = value?.toLocaleUpperCase("tr-TR") ?? "";
  if (normalized.includes("NAKİT") || normalized.includes("NAKIT") || normalized === "CASH") return PaymentMethod.CASH;
  if (normalized.includes("TRANSFER")) return PaymentMethod.TRANSFER;
  if (normalized.includes("ONLINE")) return PaymentMethod.ONLINE;
  return PaymentMethod.CARD;
}

async function mappedEntityId(tx: Prisma.TransactionClient, organizationId: string, deviceId: string, entityType: string, clientId: string) {
  const mapping = await tx.mobileSyncRecord.findFirst({
    where: { organizationId, deviceId, entityType, clientId, serverEntityId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { serverEntityId: true }
  });
  return mapping?.serverEntityId ?? null;
}

async function applyOperation(tx: Prisma.TransactionClient, session: AuthSession, branchId: string, deviceId: string, operation: MobileSyncOperation) {
  const organizationId = session.organizationId;
  if (operation.entityType === "PATIENT") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "PATIENT", operation.clientId);
    if (operation.action === "DELETE") {
      if (existingId) await tx.patient.updateMany({ where: { id: existingId, organizationId, deletedAt: null }, data: { deletedAt: new Date(), purgeAt: new Date(Date.now() + 30 * 86_400_000), deletedById: session.userId } });
      return existingId;
    }
    const payload = patientPayload.parse(operation.payload);
    const names = splitName(payload.name);
    if (existingId) {
      await tx.patient.updateMany({ where: { id: existingId, organizationId }, data: { ...names, phone: payload.phone, phoneNormalized: normalizePhone(payload.phone), email: payload.email || null, tag: payload.tag, notes: payload.note || null, deletedAt: null, purgeAt: null } });
      return existingId;
    }
    const patient = await tx.patient.create({ data: { ...names, phone: payload.phone, phoneNormalized: normalizePhone(payload.phone), email: payload.email || null, tag: payload.tag, notes: payload.note || null, organizationId, branchId } });
    return patient.id;
  }

  if (operation.entityType === "APPOINTMENT") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "APPOINTMENT", operation.clientId);
    if (operation.action === "DELETE") {
      if (existingId) await tx.appointment.updateMany({ where: { id: existingId, organizationId }, data: { status: AppointmentStatus.CANCELLED } });
      return existingId;
    }
    const payload = appointmentPayload.parse(operation.payload);
    if (existingId && operation.action === "UPDATE") {
      await tx.appointment.updateMany({ where: { id: existingId, organizationId }, data: { status: payload.status as AppointmentStatus } });
      return existingId;
    }
    const patientId = await mappedEntityId(tx, organizationId, deviceId, "PATIENT", payload.patientId);
    if (!patientId) throw new Error("Önce bağlı hasta eşitlenmelidir.");
    const doctor = await tx.user.findFirst({
      where: { organizationId, active: true, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, ...(payload.doctor ? { name: payload.doctor } : {}) },
      orderBy: { createdAt: "asc" }, select: { id: true }
    }) ?? await tx.user.findFirst({ where: { organizationId, active: true, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] } }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!doctor) throw new Error("Sunucuda aktif doktor bulunamadı.");
    const startsAt = new Date(`${payload.date}T${payload.time}:00`);
    const endsAt = new Date(startsAt.getTime() + payload.duration * 60_000);
    const candidates = await tx.appointment.findMany({
      where: { organizationId, doctorId: doctor.id, status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] }, startsAt: { gte: new Date(startsAt.getTime() - 4 * 60 * 60_000), lt: endsAt } },
      select: { startsAt: true, durationMinutes: true }
    });
    if (candidates.some((item) => item.startsAt < endsAt && new Date(item.startsAt.getTime() + item.durationMinutes * 60_000) > startsAt)) throw new Error("Doktorun bu saat aralığında başka randevusu var.");
    const appointment = await tx.appointment.create({ data: { patientId, doctorId: doctor.id, startsAt, durationMinutes: payload.duration, room: payload.room || null, treatmentType: payload.treatment, status: payload.status as AppointmentStatus, notes: "Android yerel kaydından eşitlendi.", organizationId, branchId } });
    return appointment.id;
  }

  if (operation.entityType === "TREATMENT_PLAN") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "TREATMENT_PLAN", operation.clientId);
    if (operation.action === "DELETE") {
      if (existingId) await tx.treatmentPlan.deleteMany({ where: { id: existingId, organizationId } });
      return existingId;
    }
    const payload = treatmentPlanPayload.parse(operation.payload);
    const patientId = await mappedEntityId(tx, organizationId, deviceId, "PATIENT", payload.patientId);
    if (!patientId) throw new Error("Önce bağlı hasta eşitlenmelidir.");
    const patient = await tx.patient.findFirst({ where: { id: patientId, organizationId, deletedAt: null }, select: { branchId: true } });
    if (!patient) throw new Error("Hasta bulunamadı.");
    const doctor = await tx.user.findFirst({ where: { organizationId, active: true, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, name: payload.doctor }, select: { id: true } })
      ?? await tx.user.findFirst({ where: { organizationId, active: true, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] } }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!doctor) throw new Error("Sunucuda aktif doktor bulunamadı.");
    const data = { patientId, doctorId: doctor.id, toothNumber: payload.toothNumber || null, treatmentType: payload.treatmentType, description: payload.description || null, estimatedFee: payload.estimatedFee, status: payload.status as TreatmentStatus, plannedAt: new Date(`${payload.date}T12:00:00`), organizationId, branchId: patient.branchId };
    if (existingId) {
      await tx.treatmentPlan.updateMany({ where: { id: existingId, organizationId }, data });
      return existingId;
    }
    const plan = await tx.treatmentPlan.create({ data });
    return plan.id;
  }

  if (operation.entityType === "STOCK_ITEM") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "STOCK_ITEM", operation.clientId);
    if (operation.action === "DELETE") {
      if (existingId) await tx.stockItem.deleteMany({ where: { id: existingId, organizationId } });
      return existingId;
    }
    const payload = stockItemPayload.parse(operation.payload);
    if (existingId) {
      await tx.stockItem.updateMany({ where: { id: existingId, organizationId }, data: { name: payload.name, category: payload.category, minimumQuantity: payload.minimumQuantity, unit: payload.unit, supplier: payload.supplier || null, purchasePrice: payload.purchasePrice } });
      return existingId;
    }
    const item = await tx.stockItem.create({ data: { name: payload.name, category: payload.category, currentQuantity: payload.currentQuantity, minimumQuantity: payload.minimumQuantity, unit: payload.unit, supplier: payload.supplier || null, purchasePrice: payload.purchasePrice, organizationId, branchId } });
    if (payload.currentQuantity > 0) await tx.stockMovement.create({ data: { itemId: item.id, type: StockMovementType.IN, quantity: payload.currentQuantity, note: "Android açılış stoku", organizationId, branchId } });
    return item.id;
  }

  if (operation.entityType === "STOCK_MOVEMENT") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "STOCK_MOVEMENT", operation.clientId);
    if (existingId) return existingId;
    if (operation.action !== "CREATE") throw new Error("Stok hareketleri yalnızca eklenebilir.");
    const payload = stockMovementPayload.parse(operation.payload);
    const itemId = await mappedEntityId(tx, organizationId, deviceId, "STOCK_ITEM", payload.itemId);
    if (!itemId) throw new Error("Önce bağlı stok ürünü eşitlenmelidir.");
    const item = await tx.stockItem.findFirst({ where: { id: itemId, organizationId } });
    if (!item) throw new Error("Stok ürünü bulunamadı.");
    if (payload.type === "OUT" && payload.quantity > item.currentQuantity) throw new Error(`Stok yetersiz. Mevcut miktar: ${item.currentQuantity}.`);
    const nextQuantity = payload.type === "IN" ? item.currentQuantity + payload.quantity : payload.type === "OUT" ? item.currentQuantity - payload.quantity : payload.quantity;
    await tx.stockItem.update({ where: { id: item.id }, data: { currentQuantity: nextQuantity } });
    const movement = await tx.stockMovement.create({ data: { itemId: item.id, type: payload.type as StockMovementType, quantity: payload.quantity, note: payload.note || null, organizationId, branchId: item.branchId } });
    return movement.id;
  }

  if (operation.entityType === "STOCK_OFFER") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "STOCK_OFFER", operation.clientId);
    if (existingId) return existingId;
    if (operation.action !== "CREATE") throw new Error("Satın alma fiyatları yalnızca eklenebilir.");
    const payload = stockOfferPayload.parse(operation.payload);
    const itemId = await mappedEntityId(tx, organizationId, deviceId, "STOCK_ITEM", payload.itemId);
    if (!itemId) throw new Error("Önce bağlı stok ürünü eşitlenmelidir.");
    const item = await tx.stockItem.findFirst({ where: { id: itemId, organizationId }, select: { branchId: true } });
    if (!item) throw new Error("Stok ürünü bulunamadı.");
    const offer = await tx.stockOffer.create({ data: { itemId, seller: payload.seller, unitPrice: payload.unitPrice, shippingPrice: payload.shippingPrice, productUrl: payload.productUrl, inStock: payload.inStock, checkedAt: new Date(), organizationId, branchId: item.branchId } });
    return offer.id;
  }

  const existingId = await mappedEntityId(tx, organizationId, deviceId, "PAYMENT", operation.clientId);
  if (operation.action === "DELETE") {
    if (existingId) await tx.payment.updateMany({ where: { id: existingId, organizationId }, data: { status: PaymentStatus.CANCELLED } });
    return existingId;
  }
  if (existingId) return existingId;
  const payload = paymentPayload.parse(operation.payload);
  const patientId = await mappedEntityId(tx, organizationId, deviceId, "PATIENT", payload.patientId);
  if (!patientId) throw new Error("Önce bağlı hasta eşitlenmelidir.");
  const totalAmount = payload.totalAmount ?? payload.amount;
  const payment = await tx.payment.create({ data: {
    patientId, type: PaymentType.INCOME, amount: payload.amount, listAmount: totalAmount,
    isDeposit: payload.isDeposit ?? (payload.remainingAmount ?? Math.max(0, totalAmount - payload.amount)) > 0,
    method: paymentMethod(payload.method), description: payload.description || payload.detail || "Android yerel tahsilatı",
    status: PaymentStatus.PAID, organizationId, branchId
  } });
  return payment.id;
}

export async function syncMobileOperations(session: AuthSession, batch: MobileSyncBatch) {
  const branchId = await getWritableBranchId(session);
  const results: SyncResult[] = [];

  for (const operation of batch.operations) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.mobileSyncRecord.findUnique({
          where: { organizationId_deviceId_operationId: { organizationId: session.organizationId, deviceId: batch.deviceId, operationId: operation.operationId } }
        });
        const hash = payloadHash(operation);
        if (existing) {
          if (existing.payloadHash !== hash) throw new Error("Aynı işlem kimliği farklı veriyle tekrar kullanılamaz.");
          return existing.serverEntityId ?? undefined;
        }
        const serverEntityId = await applyOperation(tx, session, branchId, batch.deviceId, operation);
        await tx.mobileSyncRecord.create({ data: {
          organizationId: session.organizationId, deviceId: batch.deviceId, operationId: operation.operationId,
          entityType: operation.entityType, action: operation.action, clientId: operation.clientId,
          serverEntityId, payloadHash: hash
        } });
        return serverEntityId ?? undefined;
      });
      results.push({ operationId: operation.operationId, status: "synced", serverEntityId: result });
    } catch (error) {
      const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Kayıt eşitlenemedi.";
      results.push({ operationId: operation.operationId, status: "failed", error: message || "Kayıt eşitlenemedi." });
    }
  }
  return results;
}
