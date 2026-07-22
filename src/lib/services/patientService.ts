import { Gender, PatientTag } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PatientInput } from "@/lib/validations/patient";
import { writeAuditLog } from "@/lib/services/auditLogService";
import { normalizePhone } from "@/lib/phone";

function optional(value?: string | null) {
  return value && value.length > 0 ? value : null;
}

export async function getPatients(organizationId: string, query?: string) {
  return prisma.patient.findMany({
    where: {
      organizationId,
      deletedAt: null,
      OR: query
        ? [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } }
          ]
        : undefined
    },
    include: {
      branch: { select: { name: true } },
      appointments: { orderBy: { startsAt: "desc" }, take: 1 },
      payments: { orderBy: { paidAt: "desc" }, take: 3 }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}

export async function getPatientById(organizationId: string, id: string) {
  return prisma.patient.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: {
      branch: true,
      appointments: { include: { doctor: { select: { name: true } } }, orderBy: { startsAt: "desc" } },
      treatmentPlans: { include: { doctor: { select: { name: true } } }, orderBy: { plannedAt: "desc" } },
      treatments: { include: { doctor: { select: { name: true } } }, orderBy: { performedAt: "desc" } },
      payments: { orderBy: { paidAt: "desc" } },
      consents: { orderBy: { createdAt: "desc" } },
      surveyResponses: { include: { survey: true }, orderBy: { createdAt: "desc" } },
      communication: { orderBy: { createdAt: "desc" } },
      recalls: { orderBy: { dueDate: "asc" } }
    }
  });
}

export async function createPatient(organizationId: string, branchId: string, input: PatientInput) {
  return prisma.patient.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      nationalId: optional(input.nationalId),
      phone: input.phone,
      phoneNormalized: normalizePhone(input.phone),
      email: optional(input.email),
      birthDate: input.birthDate ? new Date(input.birthDate) : null,
      gender: input.gender as Gender,
      address: optional(input.address),
      allergies: optional(input.allergies),
      chronicDiseases: optional(input.chronicDiseases),
      notes: optional(input.notes),
      tag: input.tag as PatientTag,
      organizationId,
      branchId
    }
  });
}

export async function updatePatient(organizationId: string, id: string, input: PatientInput) {
  return prisma.patient.updateMany({
    where: { id, organizationId, deletedAt: null },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      nationalId: optional(input.nationalId),
      phone: input.phone,
      phoneNormalized: normalizePhone(input.phone),
      email: optional(input.email),
      birthDate: input.birthDate ? new Date(input.birthDate) : null,
      gender: input.gender as Gender,
      address: optional(input.address),
      allergies: optional(input.allergies),
      chronicDiseases: optional(input.chronicDiseases),
      notes: optional(input.notes),
      tag: input.tag as PatientTag
    }
  });
}

export async function deletePatient(organizationId: string, id: string, userId: string, branchId?: string | null) {
  const now = new Date();
  const purgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const result = await prisma.patient.updateMany({
    where: { id, organizationId, ...(branchId ? { branchId } : {}), deletedAt: null },
    data: { deletedAt: now, purgeAt, deletedById: userId, restoredAt: null, restoredById: null }
  });
  if (result.count > 0) await writeAuditLog({ userId, action: "SOFT_DELETE_PATIENT", module: "patients", entityId: id, metadata: { purgeAt: purgeAt.toISOString() }, organizationId, branchId });
  return result;
}

export async function getDeletedPatients(organizationId: string, branchId?: string | null) {
  const now = new Date();
  return prisma.patient.findMany({
    where: { organizationId, ...(branchId ? { branchId } : {}), deletedAt: { not: null }, purgeAt: { gt: now } },
    include: { branch: { select: { name: true } } },
    orderBy: { deletedAt: "desc" },
    take: 200
  });
}

export async function restorePatient(organizationId: string, id: string, userId: string, branchId?: string | null) {
  const now = new Date();
  const result = await prisma.patient.updateMany({
    where: { id, organizationId, ...(branchId ? { branchId } : {}), deletedAt: { not: null }, purgeAt: { gt: now } },
    data: { deletedAt: null, purgeAt: null, restoredAt: now, restoredById: userId }
  });
  if (result.count > 0) await writeAuditLog({ userId, action: "RESTORE_PATIENT", module: "patients", entityId: id, organizationId, branchId });
  return result;
}
