import { createHash } from "node:crypto";
import { AppointmentStatus, CommunicationChannel, CommunicationDirection, CommunicationStatus, ConsentStatus, PaymentMethod, PaymentStatus, PaymentType, Prisma, Role, StockMovementType, TreatmentStatus } from "@prisma/client";
import { z } from "zod";
import type { AuthSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isReasonableBirthDate, parseClinicDateKey, parseClinicDateTime } from "@/lib/clinic-time";
import { buildPaymentPlan } from "@/lib/payment-plan";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { assertAppointmentAvailability, isActiveSchedulingStatus, withSerializableTransaction } from "@/lib/services/appointmentAvailability";
import { canAccess } from "@/lib/rbac";
import { consumeTreatmentRecipe, normalizeTreatmentKey, releaseTreatmentRecipe } from "@/lib/services/treatmentStockService";
import { applyStockQuantityChange, stockTrashPurgeAt } from "@/lib/services/stockService";
import { publicErrorMessage } from "@/lib/public-error";
import type { MobileSyncBatch, MobileSyncOperation } from "@/lib/validations/mobile-sync";
import { secureHttpsUrlSchema } from "@/lib/validations/common";

const localId = z.union([z.string().trim().min(1).max(128), z.number().int().safe().nonnegative()]).transform(String);

const patientPayload = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(8).max(40),
  email: z.string().trim().email().max(240).or(z.literal("")).optional(),
  tag: z.enum(["NEW", "ACTIVE", "PASSIVE", "RISKY", "VIP"]).default("NEW"),
  treatment: z.string().max(160).optional(),
  note: z.string().max(4000).optional(),
  nationalId: z.string().trim().max(40).optional(), birthDate: z.string().refine(isReasonableBirthDate).optional(),
  gender: z.enum(["FEMALE", "MALE", "OTHER", "UNSPECIFIED"]).default("UNSPECIFIED"),
  address: z.string().max(1000).optional(), allergies: z.string().max(2000).optional(),
  chronicDiseases: z.string().max(2000).optional(), medications: z.string().max(2000).optional()
});

const appointmentPayload = z.object({
  patientId: localId,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.coerce.number().int().min(15).max(240),
  treatment: z.string().trim().min(2).max(200),
  doctor: z.string().trim().max(160).optional(),
  room: z.string().max(80).optional(),
  status: z.enum(["PENDING_CONFIRMATION", "PLANNED", "ARRIVED", "NO_SHOW", "CANCELLED", "COMPLETED"]).default("PLANNED")
});

const paymentPayload = z.object({
  patientId: localId.optional(),
  type: z.enum(["INCOME", "EXPENSE"]).default("INCOME"),
  amount: z.coerce.number().positive().max(100_000_000),
  totalAmount: z.coerce.number().positive().max(100_000_000).optional(),
  remainingAmount: z.coerce.number().min(0).max(100_000_000).optional(),
  method: z.string().trim().max(40).optional(),
  description: z.string().max(1000).optional(),
  detail: z.string().max(1000).optional(),
  isDeposit: z.boolean().optional(), status: z.enum(["PAID", "PENDING", "CANCELLED"]).default("PAID"),
  paidAt: z.string().refine((value) => Boolean(parseClinicDateKey(value) || parseClinicDateTime(value))).optional(),
  dueDate: z.string().refine((value) => Boolean(parseClinicDateKey(value))).optional(), referralSource: z.string().max(200).optional(),
  discountAmount: z.coerce.number().min(0).max(100_000_000).optional()
});

const stockItemPayload = z.object({
  name: z.string().trim().min(2).max(200), category: z.string().trim().min(2).max(120),
  currentQuantity: z.coerce.number().int().min(0).max(100_000_000), minimumQuantity: z.coerce.number().int().min(0).max(100_000_000),
  unit: z.string().trim().min(1).max(40), supplier: z.string().trim().max(200).optional(), purchasePrice: z.coerce.number().min(0).max(100_000_000)
});

const treatmentPlanPayload = z.object({
  patientId: localId, doctor: z.string().trim().min(2).max(160),
  toothNumber: z.string().trim().max(40).optional(), treatmentType: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(), estimatedFee: z.coerce.number().min(0).max(100_000_000),
  paymentPlan: z.object({ downPayment: z.coerce.number().min(0), installmentCount: z.coerce.number().int().min(1).max(24), firstInstallmentDate: z.string().refine((value) => !value || Boolean(parseClinicDateKey(value))).optional(), note: z.string().max(500).optional() }).nullable().optional(),
  status: z.enum(["PROPOSED", "ACCEPTED", "STARTED", "COMPLETED", "CANCELLED"]),
  date: z.string().refine((value) => Boolean(parseClinicDateKey(value)))
});

const doctorPayload = z.object({ name: z.string().trim().min(2).max(160), email: z.string().trim().email().max(240), specialty: z.string().trim().max(160).optional() });
const clinicConfigPayload = z.object({ clinicName: z.string().trim().min(2).max(120), chairs: z.array(z.string().trim().min(2).max(80)).max(100) });

const stockMovementPayload = z.object({
  itemId: localId, type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().int().min(0).max(100_000_000), note: z.string().trim().max(500).optional()
}).refine((value) => value.type === "ADJUSTMENT" || value.quantity > 0, { message: "Stok giriş ve çıkış miktarı sıfırdan büyük olmalıdır.", path: ["quantity"] });

const stockOfferPayload = z.object({
  itemId: localId, seller: z.string().trim().min(2).max(200),
  unitPrice: z.coerce.number().positive().max(100_000_000), shippingPrice: z.coerce.number().min(0).max(100_000_000),
  productUrl: secureHttpsUrlSchema, inStock: z.boolean().default(true)
});

const stockRecipePayload = z.object({
  treatmentType: z.string().trim().min(2).max(200),
  itemId: localId,
  quantity: z.coerce.number().int().min(1).max(100_000)
});

const treatmentPayload = z.object({
  patientId: localId, doctor: z.string().trim().min(2).max(160),
  toothNumber: z.string().trim().max(40).optional(), treatmentType: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(), fee: z.coerce.number().min(0).max(100_000_000),
  paymentPlan: treatmentPlanPayload.shape.paymentPlan, status: z.enum(["PROPOSED", "ACCEPTED", "STARTED", "COMPLETED", "CANCELLED"]),
  date: z.string().refine((value) => Boolean(parseClinicDateKey(value)))
});

const staffPayload = z.object({
  fullName: z.string().trim().min(2).max(160), roleLabel: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional(), email: z.string().trim().email().max(240).or(z.literal("")).optional(),
  workingHours: z.string().trim().max(160).optional(), compensation: z.string().trim().max(160).optional(), active: z.boolean().default(true)
});

const consentPayload = z.object({
  patientId: localId, templateName: z.string().trim().min(2).max(200),
  content: z.string().trim().min(3).max(20_000), status: z.enum(["DRAFT", "SENT", "SIGNED", "CANCELLED"])
});

const communicationPayload = z.object({
  patientId: localId.optional(), channel: z.enum(["WHATSAPP", "SMS", "EMAIL", "PHONE", "IN_APP"]),
  direction: z.enum(["INBOUND", "OUTBOUND"]).default("OUTBOUND"), subject: z.string().trim().max(300).optional(),
  source: z.string().trim().max(200).optional(), contactName: z.string().trim().max(160).optional(), contactValue: z.string().trim().max(240).optional(),
  message: z.string().trim().min(1).max(10_000),
  status: z.enum(["QUEUED", "SENT", "DELIVERED", "FAILED"]).default("QUEUED")
});
type SyncResult = { operationId: string; status: "synced" | "failed"; serverEntityId?: string; error?: string };

function canManageTrash(role: Role) {
  return role === Role.CLINIC_OWNER || role === Role.MANAGER;
}

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
  if (["SURVEY", "SURVEY_RESPONSE", "RECALL"].includes(operation.entityType)) {
    throw new Error("Bu mobil modül kaldırıldı.");
  }
  if (operation.entityType === "LEAD") throw new Error("Sağlık turizmi modülü kaldırıldı.");
  if (operation.entityType === "CLINIC_CONFIG") {
    if (operation.action === "DELETE") throw new Error("Klinik ayarları silinemez.");
    const payload = clinicConfigPayload.parse(operation.payload);
    await tx.organization.update({ where: { id: organizationId }, data: { name: payload.clinicName, clinicSettings: { chairs: payload.chairs } } });
    return organizationId;
  }
  if (operation.entityType === "DOCTOR") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "DOCTOR", operation.clientId);
    if (operation.action === "DELETE") {
      if (existingId) {
        const existingDoctor = await tx.user.findFirst({ where: { id: existingId, organizationId }, select: { role: true, branchId: true } });
        if (!existingDoctor || existingDoctor.role !== Role.DOCTOR || existingDoctor.branchId !== branchId) {
          throw new Error("Bu hekim kaydı mobil uygulamadan değiştirilemez.");
        }
        const updated = await tx.user.updateMany({ where: { id: existingId, organizationId, branchId, role: Role.DOCTOR }, data: { active: false } });
        if (updated.count !== 1) throw new Error("Doktor kaydı aynı anda değiştirildi. Lütfen yeniden deneyin.");
      }
      return existingId;
    }
    const payload = doctorPayload.parse(operation.payload);
    if (existingId) {
      const existingDoctor = await tx.user.findFirst({ where: { id: existingId, organizationId }, select: { role: true, branchId: true } });
      if (!existingDoctor || existingDoctor.role !== Role.DOCTOR || existingDoctor.branchId !== branchId) {
        throw new Error("Bu hekim kaydı mobil uygulamadan değiştirilemez.");
      }
      const updated = await tx.user.updateMany({ where: { id: existingId, organizationId, branchId, role: Role.DOCTOR }, data: { name: payload.name, email: payload.email.toLowerCase(), active: true } });
      if (updated.count !== 1) throw new Error("Doktor kaydı aynı anda değiştirildi. Lütfen yeniden deneyin.");
      return existingId;
    }
    const duplicate = await tx.user.findUnique({ where: { email: payload.email.toLowerCase() } });
    if (duplicate && duplicate.organizationId !== organizationId) throw new Error("Doktor e-postası başka bir klinikte kayıtlı.");
    if (duplicate) {
      if (duplicate.role !== Role.DOCTOR) throw new Error("Bu e-posta başka bir personel rolü tarafından kullanılıyor.");
      if (duplicate.branchId !== branchId) throw new Error("Doktor e-postası başka bir şubede veya tüm şubelerde kayıtlı.");
      await tx.user.update({ where: { id: duplicate.id }, data: { name: payload.name, active: true } });
      return duplicate.id;
    }
    const doctor = await tx.user.create({ data: { name: payload.name, email: payload.email.toLowerCase(), passwordHash: await hashPassword(crypto.randomUUID()), role: Role.DOCTOR, active: true, organizationId, branchId } });
    return doctor.id;
  }
  if (operation.entityType === "PATIENT") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "PATIENT", operation.clientId);
    if (operation.action === "DELETE") {
      if (existingId) await tx.patient.updateMany({ where: { id: existingId, organizationId, branchId, deletedAt: null }, data: { deletedAt: new Date(), purgeAt: new Date(Date.now() + 30 * 86_400_000), deletedById: session.userId } });
      return existingId;
    }
    const payload = patientPayload.parse(operation.payload);
    const names = splitName(payload.name);
    const patientData = { ...names, phone: payload.phone, phoneNormalized: normalizePhone(payload.phone), email: payload.email || null, tag: payload.tag,
      notes: payload.note || null, nationalId: payload.nationalId || null, birthDate: payload.birthDate ? parseClinicDateTime(`${payload.birthDate}T12:00`)! : null,
      gender: payload.gender, address: payload.address || null, allergies: payload.allergies || null, chronicDiseases: payload.chronicDiseases || null, medications: payload.medications || null };
    if (existingId) {
      const updated = await tx.patient.updateMany({ where: { id: existingId, organizationId, branchId }, data: { ...patientData, deletedAt: null, purgeAt: null } });
      if (!updated.count) throw new Error("Hasta kaydı bu şubede bulunamadı.");
      return existingId;
    }
    const patient = await tx.patient.create({ data: { ...patientData, organizationId, branchId } });
    return patient.id;
  }

  if (operation.entityType === "APPOINTMENT") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "APPOINTMENT", operation.clientId);
    if (operation.action === "DELETE") {
      if (existingId) {
        const appointment = await tx.appointment.findFirst({ where: { id: existingId, organizationId, branchId } });
        if (!appointment) throw new Error("Randevu bulunamadı.");
        if (appointment?.status === AppointmentStatus.COMPLETED) await releaseTreatmentRecipe(tx, organizationId, appointment.branchId, appointment.treatmentType, { appointmentId: appointment.id });
        const updated = await tx.appointment.updateMany({
          where: { id: existingId, organizationId, branchId, status: appointment.status },
          data: { status: AppointmentStatus.CANCELLED }
        });
        if (updated.count !== 1) throw new Error("Randevu aynı anda değiştirildi. Lütfen yeniden deneyin.");
      }
      return existingId;
    }
    const payload = appointmentPayload.parse(operation.payload);
    if (existingId) {
      const appointment = await tx.appointment.findFirst({ where: { id: existingId, organizationId, branchId } });
      if (!appointment) throw new Error("Randevu bulunamadı.");
      const patientId = await mappedEntityId(tx, organizationId, deviceId, "PATIENT", payload.patientId);
      if (!patientId) throw new Error("Önce bağlı hasta eşitlenmelidir.");
      if (!await tx.patient.findFirst({ where: { id: patientId, organizationId, branchId, deletedAt: null }, select: { id: true } })) throw new Error("Hasta bu şubede bulunamadı.");
      const doctor = await tx.user.findFirst({
        where: { organizationId, active: true, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, OR: [{ branchId }, { branchId: null }], ...(payload.doctor ? { name: payload.doctor } : {}) },
        orderBy: { createdAt: "asc" }, select: { id: true }
      }) ?? await tx.user.findFirst({ where: { organizationId, active: true, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, OR: [{ branchId }, { branchId: null }] }, orderBy: { createdAt: "asc" }, select: { id: true } });
      if (!doctor) throw new Error("Sunucuda aktif doktor bulunamadı.");
      const startsAt = parseClinicDateTime(`${payload.date}T${payload.time}`);
      if (!startsAt) throw new Error("Randevu tarihi veya saati geçersiz.");
      const nextStatus = payload.status as AppointmentStatus;
      if (isActiveSchedulingStatus(nextStatus)) {
        await assertAppointmentAvailability(tx, {
          organizationId,
          branchId,
          doctorId: doctor.id,
          startsAt,
          durationMinutes: payload.duration,
          room: payload.room,
          excludeAppointmentId: appointment.id
        });
      }
      const recipeChanged = normalizeTreatmentKey(appointment.treatmentType) !== normalizeTreatmentKey(payload.treatment);
      if (appointment.status === AppointmentStatus.COMPLETED && (nextStatus !== AppointmentStatus.COMPLETED || recipeChanged)) {
        await releaseTreatmentRecipe(tx, organizationId, appointment.branchId, appointment.treatmentType, { appointmentId: appointment.id });
      }
      if (nextStatus === AppointmentStatus.COMPLETED && (appointment.status !== AppointmentStatus.COMPLETED || recipeChanged)) {
        await consumeTreatmentRecipe(tx, organizationId, appointment.branchId, payload.treatment, { appointmentId: appointment.id });
      }
      const updated = await tx.appointment.updateMany({
        where: { id: appointment.id, organizationId, branchId, status: appointment.status },
        data: { patientId, doctorId: doctor.id, startsAt, durationMinutes: payload.duration, room: payload.room || null, treatmentType: payload.treatment, status: nextStatus }
      });
      if (updated.count !== 1) throw new Error("Randevu aynı anda değiştirildi. Lütfen yeniden deneyin.");
      return existingId;
    }
    const patientId = await mappedEntityId(tx, organizationId, deviceId, "PATIENT", payload.patientId);
    if (!patientId) throw new Error("Önce bağlı hasta eşitlenmelidir.");
    if (!await tx.patient.findFirst({ where: { id: patientId, organizationId, branchId, deletedAt: null }, select: { id: true } })) throw new Error("Hasta bu şubede bulunamadı.");
    const doctor = await tx.user.findFirst({
      where: { organizationId, active: true, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, OR: [{ branchId }, { branchId: null }], ...(payload.doctor ? { name: payload.doctor } : {}) },
      orderBy: { createdAt: "asc" }, select: { id: true }
    }) ?? await tx.user.findFirst({ where: { organizationId, active: true, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, OR: [{ branchId }, { branchId: null }] }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!doctor) throw new Error("Sunucuda aktif doktor bulunamadı.");
    const startsAt = parseClinicDateTime(`${payload.date}T${payload.time}`);
    if (!startsAt) throw new Error("Randevu tarihi veya saati geçersiz.");
    if (isActiveSchedulingStatus(payload.status as AppointmentStatus)) {
      await assertAppointmentAvailability(tx, {
        organizationId,
        branchId,
        doctorId: doctor.id,
        startsAt,
        durationMinutes: payload.duration,
        room: payload.room
      });
    }
    const appointment = await tx.appointment.create({ data: { patientId, doctorId: doctor.id, startsAt, durationMinutes: payload.duration, room: payload.room || null, treatmentType: payload.treatment, status: payload.status as AppointmentStatus, notes: "Android yerel kaydından eşitlendi.", organizationId, branchId } });
    if (appointment.status === AppointmentStatus.COMPLETED) await consumeTreatmentRecipe(tx, organizationId, branchId, appointment.treatmentType, { appointmentId: appointment.id });
    return appointment.id;
  }

  if (operation.entityType === "TREATMENT_PLAN") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "TREATMENT_PLAN", operation.clientId);
    if (operation.action === "DELETE") {
      if (existingId) await tx.treatmentPlan.deleteMany({ where: { id: existingId, organizationId, branchId } });
      return existingId;
    }
    const payload = treatmentPlanPayload.parse(operation.payload);
    const patientId = await mappedEntityId(tx, organizationId, deviceId, "PATIENT", payload.patientId);
    if (!patientId) throw new Error("Önce bağlı hasta eşitlenmelidir.");
    const patient = await tx.patient.findFirst({ where: { id: patientId, organizationId, branchId, deletedAt: null }, select: { branchId: true } });
    if (!patient) throw new Error("Hasta bulunamadı.");
    const doctor = await tx.user.findFirst({ where: { organizationId, active: true, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, OR: [{ branchId }, { branchId: null }], name: payload.doctor }, select: { id: true } })
      ?? await tx.user.findFirst({ where: { organizationId, active: true, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, OR: [{ branchId }, { branchId: null }] }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!doctor) throw new Error("Sunucuda aktif doktor bulunamadı.");
    const paymentPlan: Prisma.InputJsonValue | typeof Prisma.JsonNull = payload.paymentPlan ? buildPaymentPlan({ total: payload.estimatedFee, downPayment: payload.paymentPlan.downPayment, installmentCount: payload.paymentPlan.installmentCount, firstInstallmentDate: payload.paymentPlan.firstInstallmentDate || null, note: payload.paymentPlan.note || null }) as unknown as Prisma.InputJsonValue : Prisma.JsonNull;
    const data = { patientId, doctorId: doctor.id, toothNumber: payload.toothNumber || null, treatmentType: payload.treatmentType, description: payload.description || null, estimatedFee: payload.estimatedFee, paymentPlan, status: payload.status as TreatmentStatus, plannedAt: parseClinicDateTime(`${payload.date}T12:00`)!, organizationId, branchId: patient.branchId };
    if (existingId) {
      const updated = await tx.treatmentPlan.updateMany({ where: { id: existingId, organizationId, branchId }, data });
      if (updated.count) return existingId;
    }
    const plan = await tx.treatmentPlan.create({ data });
    return plan.id;
  }

  if (operation.entityType === "TREATMENT") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "TREATMENT", operation.clientId);
    if (operation.action === "DELETE") {
      if (existingId) {
        const treatment = await tx.treatment.findFirst({ where: { id: existingId, organizationId, branchId } });
        if (!treatment) throw new Error("Tedavi bulunamadı.");
        if (treatment?.status === TreatmentStatus.COMPLETED) await releaseTreatmentRecipe(tx, organizationId, treatment.branchId, treatment.treatmentType, { treatmentId: treatment.id });
        const deleted = await tx.treatment.deleteMany({ where: { id: existingId, organizationId, branchId, status: treatment.status } });
        if (deleted.count !== 1) throw new Error("Tedavi aynı anda değiştirildi. Lütfen yeniden deneyin.");
      }
      return existingId;
    }
    const payload = treatmentPayload.parse(operation.payload);
    const patientId = await mappedEntityId(tx, organizationId, deviceId, "PATIENT", payload.patientId);
    if (!patientId) throw new Error("Önce bağlı hasta eşitlenmelidir.");
    const patient = await tx.patient.findFirst({ where: { id: patientId, organizationId, branchId, deletedAt: null }, select: { branchId: true } });
    if (!patient) throw new Error("Hasta bulunamadı.");
    const doctor = await tx.user.findFirst({ where: { organizationId, active: true, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, OR: [{ branchId }, { branchId: null }], name: payload.doctor }, select: { id: true } })
      ?? await tx.user.findFirst({ where: { organizationId, active: true, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, OR: [{ branchId }, { branchId: null }] }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!doctor) throw new Error("Sunucuda aktif doktor bulunamadı.");
    const paymentPlan: Prisma.InputJsonValue | typeof Prisma.JsonNull = payload.paymentPlan ? buildPaymentPlan({ total: payload.fee, downPayment: payload.paymentPlan.downPayment, installmentCount: payload.paymentPlan.installmentCount, firstInstallmentDate: payload.paymentPlan.firstInstallmentDate || null, note: payload.paymentPlan.note || null }) as unknown as Prisma.InputJsonValue : Prisma.JsonNull;
    const data = { patientId, doctorId: doctor.id, toothNumber: payload.toothNumber || null, treatmentType: payload.treatmentType, description: payload.description || null,
      fee: payload.fee, paymentPlan, status: payload.status as TreatmentStatus, performedAt: parseClinicDateTime(`${payload.date}T12:00`)!, organizationId, branchId: patient.branchId };
    if (existingId) {
      const previous = await tx.treatment.findFirst({ where: { id: existingId, organizationId, branchId } });
      if (previous) {
        const recipeChanged = normalizeTreatmentKey(previous.treatmentType) !== normalizeTreatmentKey(payload.treatmentType);
        if (previous.status === TreatmentStatus.COMPLETED && (payload.status !== TreatmentStatus.COMPLETED || recipeChanged)) {
          await releaseTreatmentRecipe(tx, organizationId, previous.branchId, previous.treatmentType, { treatmentId: existingId });
        }
        if (payload.status === TreatmentStatus.COMPLETED && (previous.status !== TreatmentStatus.COMPLETED || recipeChanged)) {
          await consumeTreatmentRecipe(tx, organizationId, patient.branchId, payload.treatmentType, { treatmentId: existingId });
        }
        const updated = await tx.treatment.updateMany({ where: { id: existingId, organizationId, branchId, status: previous.status }, data });
        if (updated.count !== 1) throw new Error("Tedavi aynı anda değiştirildi. Lütfen yeniden deneyin.");
        return existingId;
      }
    }
    const treatment = await tx.treatment.create({ data });
    if (treatment.status === TreatmentStatus.COMPLETED) await consumeTreatmentRecipe(tx, organizationId, patient.branchId, treatment.treatmentType, { treatmentId: treatment.id });
    return treatment.id;
  }

  if (operation.entityType === "STAFF") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "STAFF", operation.clientId);
    if (operation.action === "DELETE") {
      if (existingId) await tx.staff.deleteMany({ where: { id: existingId, organizationId, branchId } });
      return existingId;
    }
    const payload = staffPayload.parse(operation.payload);
    const data = { fullName: payload.fullName, roleLabel: payload.roleLabel, phone: payload.phone || null, email: payload.email || null,
      workingHours: payload.workingHours || null, compensation: payload.compensation || null, active: payload.active, organizationId, branchId };
    if (existingId && (await tx.staff.updateMany({ where: { id: existingId, organizationId, branchId }, data })).count) return existingId;
    return (await tx.staff.create({ data })).id;
  }

  if (operation.entityType === "CONSENT") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "CONSENT", operation.clientId);
    if (operation.action === "DELETE") { if (existingId) await tx.consent.deleteMany({ where: { id: existingId, organizationId, branchId } }); return existingId; }
    const payload = consentPayload.parse(operation.payload);
    const patientId = await mappedEntityId(tx, organizationId, deviceId, "PATIENT", payload.patientId);
    if (!patientId) throw new Error("Önce bağlı hasta eşitlenmelidir.");
    const patient = await tx.patient.findFirst({ where: { id: patientId, organizationId, branchId, deletedAt: null }, select: { branchId: true } });
    if (!patient) throw new Error("Hasta bulunamadı.");
    const data = { patientId, templateName: payload.templateName, content: payload.content, status: payload.status as ConsentStatus,
      signedAt: payload.status === ConsentStatus.SIGNED ? new Date() : null, organizationId, branchId: patient.branchId };
    if (existingId && (await tx.consent.updateMany({ where: { id: existingId, organizationId, branchId }, data })).count) return existingId;
    return (await tx.consent.create({ data })).id;
  }

  if (operation.entityType === "COMMUNICATION") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "COMMUNICATION", operation.clientId);
    if (operation.action === "DELETE") { if (existingId) await tx.communicationLog.deleteMany({ where: { id: existingId, organizationId, branchId } }); return existingId; }
    const payload = communicationPayload.parse(operation.payload);
    const patientId = payload.patientId ? await mappedEntityId(tx, organizationId, deviceId, "PATIENT", payload.patientId) : null;
    if (patientId && !await tx.patient.findFirst({ where: { id: patientId, organizationId, branchId, deletedAt: null }, select: { id: true } })) throw new Error("Hasta bu şubede bulunamadı.");
    const data = { patientId, channel: payload.channel as CommunicationChannel, direction: payload.direction as CommunicationDirection, subject: payload.subject || null,
      source: payload.source || "Android", contactName: payload.contactName || null, contactValue: payload.contactValue || null,
      message: payload.message, status: payload.status as CommunicationStatus, provider: "Android yerel", organizationId, branchId };
    if (existingId && (await tx.communicationLog.updateMany({ where: { id: existingId, organizationId, branchId }, data })).count) return existingId;
    return (await tx.communicationLog.create({ data })).id;
  }

  if (operation.entityType === "STOCK_ITEM") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "STOCK_ITEM", operation.clientId);
    if (operation.action === "DELETE") {
      if (!canManageTrash(session.role)) throw new Error("Stok çöp kutusunu yönetme yetkiniz yok.");
      if (existingId) {
        const item = await tx.stockItem.findFirst({
          where: { id: existingId, organizationId, branchId },
          select: { id: true, name: true, deletedAt: true }
        });
        if (!item) throw new Error("Stok ürünü bu şubede bulunamadı.");
        if (!item.deletedAt) {
          const now = new Date();
          const purgeAt = stockTrashPurgeAt(now);
          const deleted = await tx.stockItem.updateMany({
            where: { id: item.id, organizationId, branchId, deletedAt: null },
            data: { deletedAt: now, purgeAt, deletedById: session.userId, restoredAt: null, restoredById: null }
          });
          if (deleted.count !== 1) throw new Error("Stok ürünü aynı anda değiştirildi. Lütfen yeniden deneyin.");
          await tx.auditLog.create({
            data: {
              userId: session.userId,
              action: "SOFT_DELETE_STOCK_ITEM",
              module: "stocks",
              entityId: item.id,
              metadata: { name: item.name, purgeAt: purgeAt.toISOString(), deviceId, operationId: operation.operationId },
              organizationId,
              branchId
            }
          });
        }
      }
      return existingId;
    }
    const payload = stockItemPayload.parse(operation.payload);
    if (existingId) {
      const existing = await tx.stockItem.findFirst({
        where: { id: existingId, organizationId, branchId },
        select: { id: true, name: true, deletedAt: true, purgeAt: true }
      });
      if (existing) {
        const now = new Date();
        const restore = Boolean(existing.deletedAt && existing.purgeAt && existing.purgeAt > now && operation.action === "CREATE");
        if (restore && !canManageTrash(session.role)) throw new Error("Stok çöp kutusunu yönetme yetkiniz yok.");
        if (existing.deletedAt && !restore) throw new Error("Stok ürünü çöp kutusunda. Önce geri yükleyin.");
        const updated = await tx.stockItem.updateMany({
          where: { id: existing.id, organizationId, branchId, ...(restore ? { deletedAt: { not: null }, purgeAt: { gt: now } } : { deletedAt: null }) },
          data: {
            name: payload.name, category: payload.category, minimumQuantity: payload.minimumQuantity, unit: payload.unit,
            supplier: payload.supplier || null, purchasePrice: payload.purchasePrice,
            ...(restore ? { deletedAt: null, purgeAt: null, restoredAt: now, restoredById: session.userId } : {})
          }
        });
        if (updated.count !== 1) throw new Error("Stok ürünü aynı anda değiştirildi. Lütfen yeniden deneyin.");
        if (restore) {
          await tx.auditLog.create({
            data: {
              userId: session.userId,
              action: "RESTORE_STOCK_ITEM",
              module: "stocks",
              entityId: existing.id,
              metadata: { name: payload.name || existing.name, deviceId, operationId: operation.operationId },
              organizationId,
              branchId
            }
          });
        }
        return existingId;
      }
    }
    const item = await tx.stockItem.create({ data: { name: payload.name, category: payload.category, currentQuantity: payload.currentQuantity, minimumQuantity: payload.minimumQuantity, unit: payload.unit, supplier: payload.supplier || null, purchasePrice: payload.purchasePrice, organizationId, branchId } });
    if (payload.currentQuantity > 0) await tx.stockMovement.create({ data: { itemId: item.id, type: StockMovementType.IN, quantity: payload.currentQuantity, note: "Android açılış stoku", organizationId, branchId } });
    return item.id;
  }

  if (operation.entityType === "STOCK_MOVEMENT") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "STOCK_MOVEMENT", operation.clientId);
    if (existingId && await tx.stockMovement.findFirst({ where: { id: existingId, organizationId, branchId }, select: { id: true } })) return existingId;
    if (operation.action !== "CREATE") throw new Error("Stok hareketleri yalnızca eklenebilir.");
    const payload = stockMovementPayload.parse(operation.payload);
    const itemId = await mappedEntityId(tx, organizationId, deviceId, "STOCK_ITEM", payload.itemId);
    if (!itemId) throw new Error("Önce bağlı stok ürünü eşitlenmelidir.");
    const item = await applyStockQuantityChange(tx, { organizationId, branchId, itemId, type: payload.type as StockMovementType, quantity: payload.quantity });
    const movement = await tx.stockMovement.create({ data: { itemId: item.id, type: payload.type as StockMovementType, quantity: payload.quantity, note: payload.note || null, organizationId, branchId: item.branchId } });
    return movement.id;
  }

  if (operation.entityType === "STOCK_OFFER") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "STOCK_OFFER", operation.clientId);
    if (operation.action === "DELETE") {
      if (existingId) await tx.stockOffer.deleteMany({ where: { id: existingId, organizationId, branchId } });
      return existingId;
    }
    if (existingId && await tx.stockOffer.findFirst({ where: { id: existingId, organizationId, branchId }, select: { id: true } })) return existingId;
    if (operation.action !== "CREATE") throw new Error("Satın alma fiyatları yalnızca eklenebilir veya silinebilir.");
    const payload = stockOfferPayload.parse(operation.payload);
    const itemId = await mappedEntityId(tx, organizationId, deviceId, "STOCK_ITEM", payload.itemId);
    if (!itemId) throw new Error("Önce bağlı stok ürünü eşitlenmelidir.");
    const item = await tx.stockItem.findFirst({ where: { id: itemId, organizationId, branchId, deletedAt: null }, select: { branchId: true } });
    if (!item) throw new Error("Stok ürünü bulunamadı.");
    await tx.stockOffer.deleteMany({ where: { itemId, organizationId, productUrl: payload.productUrl } });
    const offer = await tx.stockOffer.create({ data: { itemId, seller: payload.seller, unitPrice: payload.unitPrice, shippingPrice: payload.shippingPrice, productUrl: payload.productUrl, inStock: payload.inStock, checkedAt: new Date(), organizationId, branchId: item.branchId } });
    return offer.id;
  }

  if (operation.entityType === "STOCK_RECIPE") {
    const existingId = await mappedEntityId(tx, organizationId, deviceId, "STOCK_RECIPE", operation.clientId);
    if (operation.action === "DELETE") {
      if (existingId) await tx.stockRecipe.deleteMany({ where: { id: existingId, organizationId, branchId } });
      return existingId;
    }
    const payload = stockRecipePayload.parse(operation.payload);
    const itemId = await mappedEntityId(tx, organizationId, deviceId, "STOCK_ITEM", payload.itemId);
    if (!itemId) throw new Error("Önce bağlı stok ürünü eşitlenmelidir.");
    const item = await tx.stockItem.findFirst({ where: { id: itemId, organizationId, branchId, deletedAt: null }, select: { branchId: true } });
    if (!item) throw new Error("Stok ürünü bulunamadı.");
    const data = { treatmentKey: normalizeTreatmentKey(payload.treatmentType), treatmentType: payload.treatmentType, itemId, quantity: payload.quantity, organizationId, branchId: item.branchId };
    if (existingId) {
      const updated = await tx.stockRecipe.updateMany({ where: { id: existingId, organizationId, branchId }, data });
      if (updated.count) return existingId;
    }
    const recipe = await tx.stockRecipe.create({ data });
    return recipe.id;
  }

  if (operation.entityType !== "PAYMENT") throw new Error("Desteklenmeyen mobil kayıt türü.");
  const existingId = await mappedEntityId(tx, organizationId, deviceId, "PAYMENT", operation.clientId);
  if (operation.action === "DELETE") {
    if (existingId) await tx.payment.updateMany({ where: { id: existingId, organizationId, branchId }, data: { status: PaymentStatus.CANCELLED } });
    return existingId;
  }
  const payload = paymentPayload.parse(operation.payload);
  const patientId = payload.patientId ? await mappedEntityId(tx, organizationId, deviceId, "PATIENT", payload.patientId) : null;
  if (payload.type === "INCOME" && !patientId) throw new Error("Gelir için önce bağlı hasta eşitlenmelidir.");
  if (patientId && !await tx.patient.findFirst({ where: { id: patientId, organizationId, branchId, deletedAt: null }, select: { id: true } })) throw new Error("Hasta bu şubede bulunamadı.");
  const totalAmount = payload.totalAmount ?? payload.amount;
  const finalAmount = Math.max(0, totalAmount - (payload.discountAmount ?? 0));
  if ((payload.discountAmount ?? 0) > totalAmount) throw new Error("İndirim toplam tutardan büyük olamaz.");
  if (payload.type === "INCOME" && payload.amount > finalAmount) throw new Error("Tahsilat tutarı indirim sonrası son tutardan büyük olamaz.");
  const paymentData = {
    patientId, type: payload.type as PaymentType, amount: payload.amount, listAmount: totalAmount, discountAmount: payload.discountAmount ?? null,
    isDeposit: payload.isDeposit ?? (payload.remainingAmount ?? Math.max(0, totalAmount - payload.amount)) > 0,
    method: paymentMethod(payload.method), description: payload.description || payload.detail || "Android yerel tahsilatı",
    referralSource: payload.referralSource || null, status: payload.status as PaymentStatus,
    paidAt: payload.paidAt ? (parseClinicDateKey(payload.paidAt) ? parseClinicDateTime(`${payload.paidAt}T12:00`)! : parseClinicDateTime(payload.paidAt)!) : new Date(),
    dueDate: payload.dueDate ? parseClinicDateTime(`${payload.dueDate}T12:00`)! : null,
    organizationId, branchId
  };
  if (existingId) {
    const updated = await tx.payment.updateMany({ where: { id: existingId, organizationId, branchId }, data: paymentData });
    if (!updated.count) throw new Error("Finans kaydı bu şubede bulunamadı.");
    return existingId;
  }
  const payment = await tx.payment.create({ data: paymentData });
  return payment.id;
}

export async function syncMobileOperations(session: AuthSession, batch: MobileSyncBatch) {
  const branchId = await getWritableBranchId(session);
  const results: SyncResult[] = [];

  for (const operation of batch.operations) {
    try {
      const apply = async (tx: Prisma.TransactionClient) => {
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
      };
      const result = operation.entityType === "APPOINTMENT" || operation.entityType === "TREATMENT"
        ? await withSerializableTransaction(apply, "Kayıt aynı anda değiştirildi. Lütfen yeniden deneyin.")
        : await prisma.$transaction(apply);
      results.push({ operationId: operation.operationId, status: "synced", serverEntityId: result });
    } catch (error) {
      const message = publicErrorMessage(error, "Kayıt eşitlenemedi.");
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
  const now = new Date();
  const [patients, appointments, payments, plans, stocks, deletedStocks, recipes, doctors, organization, treatments, staff, consents, communication] = await Promise.all([
    includePatients ? prisma.patient.findMany({
      where: { organizationId, deletedAt: null, ...branch }, orderBy: { updatedAt: "desc" }, take: 2000,
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, tag: true, notes: true, nationalId: true, birthDate: true, gender: true, address: true, allergies: true, chronicDiseases: true, medications: true, updatedAt: true }
    }) : [],
    canAccess(session.role, "appointments") ? prisma.appointment.findMany({
      where: { organizationId, ...branch, patient: { deletedAt: null } }, orderBy: { updatedAt: "desc" }, take: 2000,
      include: { patient: { select: { id: true } }, doctor: { select: { name: true } }, stockMovements: { where: { item: { deletedAt: null } }, select: { itemId: true, type: true, quantity: true } } }
    }) : [],
    canAccess(session.role, "finance") ? prisma.payment.findMany({
      where: { organizationId, ...branch, OR: [{ patientId: null }, { patient: { deletedAt: null } }] }, orderBy: { updatedAt: "desc" }, take: 2000,
      include: { patient: { select: { id: true, firstName: true, lastName: true } } }
    }) : [],
    canAccess(session.role, "treatments") ? prisma.treatmentPlan.findMany({
      where: { organizationId, ...branch, patient: { deletedAt: null } }, orderBy: { updatedAt: "desc" }, take: 2000,
      include: { patient: { select: { id: true, firstName: true, lastName: true } }, doctor: { select: { name: true } }, branch: { select: { name: true } } }
    }) : [],
    canAccess(session.role, "stocks") ? prisma.stockItem.findMany({
      where: { organizationId, deletedAt: null, ...branch }, orderBy: { updatedAt: "desc" }, take: 2000,
      include: { offers: { orderBy: { checkedAt: "desc" }, take: 10 } }
    }) : [],
    canAccess(session.role, "stocks") && canManageTrash(session.role) ? prisma.stockItem.findMany({
      where: { organizationId, deletedAt: { not: null }, purgeAt: { gt: now }, ...branch },
      orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
      take: 2000,
      include: { branch: { select: { name: true } } }
    }) : [],
    canAccess(session.role, "stocks") ? prisma.stockRecipe.findMany({ where: { organizationId, ...branch, item: { deletedAt: null } }, orderBy: { updatedAt: "desc" }, take: 2000 }) : [],
    canAccess(session.role, "staff") ? prisma.user.findMany({ where: { organizationId, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, active: true, ...(session.branchId ? { OR: [{ branchId: session.branchId }, { branchId: null }] } : {}) }, orderBy: { name: "asc" } }) : [],
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, clinicSettings: true } }),
    canAccess(session.role, "treatments") ? prisma.treatment.findMany({ where: { organizationId, ...branch, patient: { deletedAt: null } }, include: { patient: { select: { id: true, firstName: true, lastName: true } }, doctor: { select: { name: true } }, branch: { select: { name: true } }, stockMovements: { where: { item: { deletedAt: null } }, select: { itemId: true, type: true, quantity: true } } }, orderBy: { updatedAt: "desc" }, take: 2000 }) : [],
    canAccess(session.role, "staff") ? prisma.staff.findMany({ where: { organizationId, ...branch }, orderBy: { updatedAt: "desc" }, take: 2000 }) : [],
    canAccess(session.role, "consents") ? prisma.consent.findMany({ where: { organizationId, ...branch, patient: { deletedAt: null } }, include: { patient: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { updatedAt: "desc" }, take: 2000 }) : [],
    canAccess(session.role, "communication") ? prisma.communicationLog.findMany({ where: { organizationId, ...branch, OR: [{ patientId: null }, { patient: { deletedAt: null } }] }, include: { patient: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { updatedAt: "desc" }, take: 2000 }) : []
  ]);
  const snapshotMappings = [
    ...patients.map((item) => ["PATIENT", item.id]),
    ...appointments.map((item) => ["APPOINTMENT", item.id]),
    ...payments.map((item) => ["PAYMENT", item.id]),
    ...plans.map((item) => ["TREATMENT_PLAN", item.id]),
    ...stocks.map((item) => ["STOCK_ITEM", item.id]),
    ...deletedStocks.map((item) => ["STOCK_ITEM", item.id]),
    ...stocks.flatMap((item) => item.offers.map((offer) => ["STOCK_OFFER", offer.id])),
    ...recipes.map((item) => ["STOCK_RECIPE", item.id]),
    ...doctors.map((item) => ["DOCTOR", item.id]),
    ...treatments.map((item) => ["TREATMENT", item.id]),
    ...staff.map((item) => ["STAFF", item.id]),
    ...consents.map((item) => ["CONSENT", item.id]),
    ...communication.map((item) => ["COMMUNICATION", item.id])
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
    permissions: {
      ...Object.fromEntries((["patients", "appointments", "finance", "treatments", "stocks", "staff", "consents", "communication", "reports", "settings"] as const).map((module) => [module, canAccess(session.role, module)])),
      trash: canManageTrash(session.role)
    },
    patients: patients.map((patient, index) => ({
      id: localSnapshotId("PATIENT", patient.id), serverId: patient.id, name: `${patient.firstName} ${patient.lastName}`.trim(), phone: patient.phone,
      email: patient.email ?? "", tag: patient.tag, lastVisit: "Sunucuyla eşitlendi", treatment: "", note: patient.notes ?? "", color: index % 5,
      nationalId: patient.nationalId ?? "", birthDate: patient.birthDate ? istanbulParts(patient.birthDate).date : "", gender: patient.gender,
      address: patient.address ?? "", allergies: patient.allergies ?? "", chronicDiseases: patient.chronicDiseases ?? "", medications: patient.medications ?? ""
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
      offers: item.offers.map((offer) => ({ id: localSnapshotId("STOCK_OFFER", offer.id), serverId: offer.id, seller: offer.seller, unitPrice: Number(offer.unitPrice), shippingPrice: Number(offer.shippingPrice), productUrl: offer.productUrl, inStock: offer.inStock, checkedAt: offer.checkedAt.toISOString(), source: "server" }))
    })),
    deletedStockItems: deletedStocks.map((item) => ({
      id: localSnapshotId("STOCK_ITEM", item.id), serverId: item.id, name: item.name, category: item.category,
      amount: item.currentQuantity, minimum: item.minimumQuantity, unit: item.unit, supplier: item.supplier ?? "",
      purchasePrice: Number(item.purchasePrice), branch: item.branch.name,
      deletedAt: item.deletedAt?.toISOString() ?? "", purgeAt: item.purgeAt?.toISOString() ?? ""
    })),
    stockRecipes: recipes.map((recipe) => ({
      id: localSnapshotId("STOCK_RECIPE", recipe.id), serverId: recipe.id, treatmentType: recipe.treatmentType,
      itemId: localSnapshotId("STOCK_ITEM", recipe.itemId), quantity: recipe.quantity
    })),
    doctors: doctors.map((doctor) => ({ id: localSnapshotId("DOCTOR", doctor.id), serverId: doctor.id, name: doctor.name, email: doctor.email, specialty: "Diş hekimi", readOnly: doctor.role !== Role.DOCTOR })),
    treatments: treatments.map((item) => ({ id: localSnapshotId("TREATMENT", item.id), serverId: item.id, patientId: localSnapshotId("PATIENT", item.patientId), patient: `${item.patient.firstName} ${item.patient.lastName}`.trim(), doctor: item.doctor.name, tooth: item.toothNumber ?? "", treatment: item.treatmentType, description: item.description ?? "", fee: Number(item.fee), paymentPlan: item.paymentPlan, status: item.status, date: istanbulParts(item.performedAt).date, branch: item.branch.name,
      stockUsage: Object.values(item.stockMovements.reduce<Record<string, { itemId: number; quantity: number }>>((usage, movement) => {
        const localItemId = localSnapshotId("STOCK_ITEM", movement.itemId);
        const current = usage[movement.itemId] ?? { itemId: localItemId, quantity: 0 };
        current.quantity += movement.type === StockMovementType.OUT ? movement.quantity : movement.type === StockMovementType.IN ? -movement.quantity : 0;
        usage[movement.itemId] = current;
        return usage;
      }, {})).filter((usage) => usage.quantity > 0) })),
    staff: staff.map((item) => ({ id: localSnapshotId("STAFF", item.id), serverId: item.id, fullName: item.fullName, roleLabel: item.roleLabel, phone: item.phone ?? "", email: item.email ?? "", workingHours: item.workingHours ?? "", compensation: item.compensation ?? "", active: item.active })),
    consents: consents.map((item) => ({ id: localSnapshotId("CONSENT", item.id), serverId: item.id, patientId: localSnapshotId("PATIENT", item.patientId), patient: `${item.patient.firstName} ${item.patient.lastName}`.trim(), templateName: item.templateName, content: item.content, status: item.status, date: item.timestamp.toISOString(), signedAt: item.signedAt?.toISOString() ?? "" })),
    communication: communication.map((item) => ({ id: localSnapshotId("COMMUNICATION", item.id), serverId: item.id, patientId: item.patientId ? localSnapshotId("PATIENT", item.patientId) : null, patient: item.patient ? `${item.patient.firstName} ${item.patient.lastName}`.trim() : item.contactName ?? "Genel", channel: item.channel, direction: item.direction, subject: item.subject ?? "", source: item.source ?? "", contactValue: item.contactValue ?? "", message: item.message, status: item.status, date: item.createdAt.toISOString() })),
    clinicConfig: { clinicName: organization?.name ?? "ClinicNova", chairs: Array.isArray((organization?.clinicSettings as { chairs?: unknown[] } | null)?.chairs) ? (organization?.clinicSettings as { chairs: unknown[] }).chairs.filter((item): item is string => typeof item === "string") : [] }
  };
}
