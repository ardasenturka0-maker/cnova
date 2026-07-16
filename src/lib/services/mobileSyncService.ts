import { createHash } from "node:crypto";
import { AppointmentStatus, PaymentMethod, PaymentStatus, PaymentType, Prisma, Role, StockMovementType, TreatmentStatus } from "@prisma/client";
import { z } from "zod";
import type { AuthSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { buildPaymentPlan } from "@/lib/payment-plan";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { canAccess } from "@/lib/rbac";
import { consumeTreatmentRecipe, normalizeTreatmentKey, releaseTreatmentRecipe } from "@/lib/services/treatmentStockService";
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
  paymentPlan: z.object({ downPayment: z.coerce.number().min(0), installmentCount: z.coerce.number().int().min(1).max(24), firstInstallmentDate: z.string().optional(), note: z.string().max(500).optional() }).nullable().optional(),
  status: z.enum(["PROPOSED", "ACCEPTED", "STARTED", "COMPLETED", "CANCELLED"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const doctorPayload = z.object({ name: z.string().trim().min(2).max(160), email: z.string().email().max(240), specialty: z.string().trim().max(160).optional() });
const clinicConfigPayload = z.object({ clinicName: z.string().trim().min(2).max(120), chairs: z.array(z.string().trim().min(2).max(80)).max(100) });

const stockMovementPayload = z.object({
  itemId: z.union([z.string(), z.number()]).transform(String), type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().int().min(0), note: z.string().trim().max(500).optional()
}).refine((value) => value.type === "ADJUSTMENT" || value.quantity > 0, { message: "Stok giriş ve çıkış miktarı sıfırdan büyük olmalıdır.", path: ["quantity"] });

const stockOfferPayload = z.object({
  itemId: z.union([z.string(), z.number()]).transform(String), seller: z.string().trim().min(2).max(200),
  unitPrice: z.coerce.number().positive().max(100_000_000), shippingPrice: z.coerce.number().min(0).max(100_000_000),
  productUrl: z.string().url().refine((url) => url.startsWith("https://"), "Yalnızca HTTPS ürün adresi kullanılabilir."), inStock: z.boolean().default(true)
});

const stockRecipePayload = z.object({
  treatmentType: z.string().trim().min(2).max(200),
  itemId: z.union([z.string(), z.number()]).transform(String),
  quantity: z.coerce.number().int().min(1).max(100_000)
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
  if (operation.entityType === "CLINIC_CONFIG") {
    if (operation.action === "DELETE") throw new Error("Klinik ayarları silinemez.");
    const payload = clinicConfigPayload.parse(operation.payload);
    await tx.organization.update({ where: { id: organizationId }, data: { name: payload.clinicName, clinicSettings: { chairs: payload.chairs } } });
    return organizationId;
  }
  if (operation.entityType === "DOCTOR") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "DOCTOR", operation.clientId);
    if (operation.action === "DELETE") {
      if (existingId) await tx.user.updateMany({ where: { id: existingId, organizationId, role: Role.DOCTOR }, data: { active: false } });
      return existingId;
    }
    const payload = doctorPayload.parse(operation.payload);
    if (existingId) {
      await tx.user.updateMany({ where: { id: existingId, organizationId, role: Role.DOCTOR }, data: { name: payload.name, email: payload.email.toLowerCase(), active: true, branchId } });
      return existingId;
    }
    const duplicate = await tx.user.findUnique({ where: { email: payload.email.toLowerCase() } });
    if (duplicate && duplicate.organizationId !== organizationId) throw new Error("Doktor e-postası başka bir klinikte kayıtlı.");
    if (duplicate) {
      await tx.user.update({ where: { id: duplicate.id }, data: { name: payload.name, role: Role.DOCTOR, active: true, branchId } });
      return duplicate.id;
    }
    const doctor = await tx.user.create({ data: { name: payload.name, email: payload.email.toLowerCase(), passwordHash: await hashPassword(crypto.randomUUID()), role: Role.DOCTOR, active: true, organizationId, branchId } });
    return doctor.id;
  }
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
      if (existingId) {
        const appointment = await tx.appointment.findFirst({ where: { id: existingId, organizationId } });
        if (appointment?.status === AppointmentStatus.COMPLETED) await releaseTreatmentRecipe(tx, organizationId, appointment.branchId, appointment.treatmentType, { appointmentId: appointment.id });
        await tx.appointment.updateMany({ where: { id: existingId, organizationId }, data: { status: AppointmentStatus.CANCELLED } });
      }
      return existingId;
    }
    const payload = appointmentPayload.parse(operation.payload);
    if (existingId && operation.action === "UPDATE") {
      const appointment = await tx.appointment.findFirst({ where: { id: existingId, organizationId } });
      if (!appointment) throw new Error("Randevu bulunamadı.");
      const nextStatus = payload.status as AppointmentStatus;
      if (appointment.status !== nextStatus) {
        if (nextStatus === AppointmentStatus.COMPLETED) await consumeTreatmentRecipe(tx, organizationId, appointment.branchId, appointment.treatmentType, { appointmentId: appointment.id });
        else if (appointment.status === AppointmentStatus.COMPLETED) await releaseTreatmentRecipe(tx, organizationId, appointment.branchId, appointment.treatmentType, { appointmentId: appointment.id });
        await tx.appointment.update({ where: { id: appointment.id }, data: { status: nextStatus } });
      }
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
    if (appointment.status === AppointmentStatus.COMPLETED) await consumeTreatmentRecipe(tx, organizationId, branchId, appointment.treatmentType, { appointmentId: appointment.id });
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
    const paymentPlan: Prisma.InputJsonValue | typeof Prisma.JsonNull = payload.paymentPlan ? buildPaymentPlan({ total: payload.estimatedFee, downPayment: payload.paymentPlan.downPayment, installmentCount: payload.paymentPlan.installmentCount, firstInstallmentDate: payload.paymentPlan.firstInstallmentDate || null, note: payload.paymentPlan.note || null }) as unknown as Prisma.InputJsonValue : Prisma.JsonNull;
    const data = { patientId, doctorId: doctor.id, toothNumber: payload.toothNumber || null, treatmentType: payload.treatmentType, description: payload.description || null, estimatedFee: payload.estimatedFee, paymentPlan, status: payload.status as TreatmentStatus, plannedAt: new Date(`${payload.date}T12:00:00`), organizationId, branchId: patient.branchId };
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
    if (operation.action === "DELETE") {
      if (existingId) await tx.stockOffer.deleteMany({ where: { id: existingId, organizationId } });
      return existingId;
    }
    if (existingId) return existingId;
    if (operation.action !== "CREATE") throw new Error("Satın alma fiyatları yalnızca eklenebilir veya silinebilir.");
    const payload = stockOfferPayload.parse(operation.payload);
    const itemId = await mappedEntityId(tx, organizationId, deviceId, "STOCK_ITEM", payload.itemId);
    if (!itemId) throw new Error("Önce bağlı stok ürünü eşitlenmelidir.");
    const item = await tx.stockItem.findFirst({ where: { id: itemId, organizationId }, select: { branchId: true } });
    if (!item) throw new Error("Stok ürünü bulunamadı.");
    const offer = await tx.stockOffer.create({ data: { itemId, seller: payload.seller, unitPrice: payload.unitPrice, shippingPrice: payload.shippingPrice, productUrl: payload.productUrl, inStock: payload.inStock, checkedAt: new Date(), organizationId, branchId: item.branchId } });
    return offer.id;
  }

  if (operation.entityType === "STOCK_RECIPE") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "STOCK_RECIPE", operation.clientId);
    if (operation.action === "DELETE") {
      if (existingId) await tx.stockRecipe.deleteMany({ where: { id: existingId, organizationId } });
      return existingId;
    }
    const payload = stockRecipePayload.parse(operation.payload);
    const itemId = await mappedEntityId(tx, organizationId, deviceId, "STOCK_ITEM", payload.itemId);
    if (!itemId) throw new Error("Önce bağlı stok ürünü eşitlenmelidir.");
    const item = await tx.stockItem.findFirst({ where: { id: itemId, organizationId }, select: { branchId: true } });
    if (!item) throw new Error("Stok ürünü bulunamadı.");
    const data = { treatmentKey: normalizeTreatmentKey(payload.treatmentType), treatmentType: payload.treatmentType, itemId, quantity: payload.quantity, organizationId, branchId: item.branchId };
    if (existingId) {
      await tx.stockRecipe.updateMany({ where: { id: existingId, organizationId }, data });
      return existingId;
    }
    const recipe = await tx.stockRecipe.create({ data });
    return recipe.id;
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

function localSnapshotId(entityType: string, id: string) {
  const value = BigInt(`0x${createHash("sha256").update(`${entityType}:${id}`).digest("hex").slice(0, 14)}`);
  return Number(value % 900_000_000_000n) + 1;
}

function istanbulParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

export async function getMobileSnapshot(session: AuthSession, deviceId: string) {
  const organizationId = session.organizationId;
  const branch = session.branchId ? { branchId: session.branchId } : {};
  const includePatients = canAccess(session.role, "patients");
  const [patients, appointments, payments, plans, stocks, recipes, doctors, organization] = await Promise.all([
    includePatients ? prisma.patient.findMany({
      where: { organizationId, deletedAt: null, ...branch }, orderBy: { updatedAt: "desc" }, take: 2000,
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, tag: true, notes: true, updatedAt: true }
    }) : [],
    canAccess(session.role, "appointments") ? prisma.appointment.findMany({
      where: { organizationId, ...branch }, orderBy: { updatedAt: "desc" }, take: 2000,
      include: { patient: { select: { id: true } }, doctor: { select: { name: true } }, stockMovements: { select: { itemId: true, type: true, quantity: true } } }
    }) : [],
    canAccess(session.role, "finance") ? prisma.payment.findMany({
      where: { organizationId, ...branch }, orderBy: { updatedAt: "desc" }, take: 2000,
      include: { patient: { select: { id: true, firstName: true, lastName: true } } }
    }) : [],
    canAccess(session.role, "treatments") ? prisma.treatmentPlan.findMany({
      where: { organizationId, ...branch }, orderBy: { updatedAt: "desc" }, take: 2000,
      include: { patient: { select: { id: true, firstName: true, lastName: true } }, doctor: { select: { name: true } }, branch: { select: { name: true } } }
    }) : [],
    canAccess(session.role, "stocks") ? prisma.stockItem.findMany({
      where: { organizationId, ...branch }, orderBy: { updatedAt: "desc" }, take: 2000,
      include: { offers: { orderBy: { checkedAt: "desc" }, take: 10 } }
    }) : [],
    canAccess(session.role, "stocks") ? prisma.stockRecipe.findMany({ where: { organizationId, ...branch }, orderBy: { updatedAt: "desc" }, take: 2000 }) : [],
    canAccess(session.role, "staff") ? prisma.user.findMany({ where: { organizationId, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, active: true, ...(session.branchId ? { OR: [{ branchId: session.branchId }, { branchId: null }] } : {}) }, orderBy: { name: "asc" } }) : [],
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, clinicSettings: true } })
  ]);
  const snapshotMappings = [
    ...patients.map((item) => ["PATIENT", item.id]),
    ...appointments.map((item) => ["APPOINTMENT", item.id]),
    ...payments.map((item) => ["PAYMENT", item.id]),
    ...plans.map((item) => ["TREATMENT_PLAN", item.id]),
    ...stocks.map((item) => ["STOCK_ITEM", item.id]),
    ...recipes.map((item) => ["STOCK_RECIPE", item.id]),
    ...doctors.map((item) => ["DOCTOR", item.id])
  ].map(([entityType, serverEntityId]) => {
    const operationId = `snapshot:${entityType}:${serverEntityId}`;
    return {
      organizationId, deviceId, operationId, entityType, action: "SNAPSHOT",
      clientId: String(localSnapshotId(entityType, serverEntityId)), serverEntityId,
      payloadHash: createHash("sha256").update(operationId).digest("hex")
    };
  });
  if (snapshotMappings.length) await prisma.mobileSyncRecord.createMany({ data: snapshotMappings, skipDuplicates: true });

  return {
    generatedAt: new Date().toISOString(),
    patients: patients.map((patient, index) => ({
      id: localSnapshotId("PATIENT", patient.id), serverId: patient.id, name: `${patient.firstName} ${patient.lastName}`.trim(), phone: patient.phone,
      email: patient.email ?? "", tag: patient.tag, lastVisit: "Sunucuyla eşitlendi", treatment: "", note: patient.notes ?? "", color: index % 5
    })),
    appointments: appointments.map((appointment) => {
      const time = istanbulParts(appointment.startsAt);
      return { id: localSnapshotId("APPOINTMENT", appointment.id), serverId: appointment.id, patientId: localSnapshotId("PATIENT", appointment.patient.id),
        date: time.date, time: time.time, duration: appointment.durationMinutes, treatment: appointment.treatmentType, doctor: appointment.doctor.name,
        room: appointment.room ?? "", status: appointment.status,
        stockUsage: Object.values(appointment.stockMovements.reduce<Record<string, { itemId: number; quantity: number }>>((usage, movement) => {
          const localItemId = localSnapshotId("STOCK_ITEM", movement.itemId);
          const current = usage[movement.itemId] ?? { itemId: localItemId, quantity: 0 };
          current.quantity += movement.type === StockMovementType.OUT ? movement.quantity : movement.type === StockMovementType.IN ? -movement.quantity : 0;
          usage[movement.itemId] = current;
          return usage;
        }, {})).filter((usage) => usage.quantity > 0) };
    }),
    transactions: payments.map((payment) => ({
      id: localSnapshotId("PAYMENT", payment.id), serverId: payment.id, patientId: payment.patientId ? localSnapshotId("PATIENT", payment.patientId) : null,
      name: payment.patient ? `${payment.patient.firstName} ${payment.patient.lastName}`.trim() : payment.description || "Finans hareketi",
      detail: `${payment.description || "Tahsilat"} · ${payment.method}`, amount: Number(payment.amount), totalAmount: Number(payment.listAmount ?? payment.amount),
      remainingAmount: Math.max(0, Number(payment.listAmount ?? payment.amount) - Number(payment.amount)), type: payment.type.toLowerCase(), status: payment.status,
      isDeposit: payment.isDeposit, date: istanbulParts(payment.paidAt).date
    })),
    treatmentPlans: plans.map((plan) => ({
      id: localSnapshotId("TREATMENT_PLAN", plan.id), serverId: plan.id, patientId: localSnapshotId("PATIENT", plan.patientId),
      patient: `${plan.patient.firstName} ${plan.patient.lastName}`.trim(), treatment: plan.treatmentType, tooth: plan.toothNumber ?? "", doctor: plan.doctor.name,
      branch: plan.branch.name, plannedAt: istanbulParts(plan.plannedAt).date, date: istanbulParts(plan.plannedAt).date,
      total: Number(plan.estimatedFee), paid: Number((plan.paymentPlan as { downPayment?: number } | null)?.downPayment ?? 0), paymentPlan: plan.paymentPlan,
      status: plan.status, statusCode: plan.status, note: plan.description ?? ""
    })),
    stockItems: stocks.map((item) => ({
      id: localSnapshotId("STOCK_ITEM", item.id), serverId: item.id, name: item.name, category: item.category, amount: item.currentQuantity,
      minimum: item.minimumQuantity, unit: item.unit, supplier: item.supplier ?? "", purchasePrice: Number(item.purchasePrice), movements: [],
      offers: item.offers.map((offer) => ({ seller: offer.seller, unitPrice: Number(offer.unitPrice), shippingPrice: Number(offer.shippingPrice), productUrl: offer.productUrl, inStock: offer.inStock }))
    })),
    stockRecipes: recipes.map((recipe) => ({
      id: localSnapshotId("STOCK_RECIPE", recipe.id), serverId: recipe.id, treatmentType: recipe.treatmentType,
      itemId: localSnapshotId("STOCK_ITEM", recipe.itemId), quantity: recipe.quantity
    })),
    doctors: doctors.map((doctor) => ({ id: localSnapshotId("DOCTOR", doctor.id), serverId: doctor.id, name: doctor.name, email: doctor.email, specialty: "Diş hekimi" })),
    clinicConfig: { clinicName: organization?.name ?? "ClinicNova", chairs: Array.isArray((organization?.clinicSettings as { chairs?: unknown[] } | null)?.chairs) ? (organization?.clinicSettings as { chairs: unknown[] }).chairs.filter((item): item is string => typeof item === "string") : [] }
  };
}
