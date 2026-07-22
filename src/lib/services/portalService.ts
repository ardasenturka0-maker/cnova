import { AppointmentStatus, PatientTag, PaymentStatus, PaymentType, Prisma, Role } from "@prisma/client";
import type { PatientSession } from "@/lib/patient-auth";
import { prisma } from "@/lib/prisma";
import { assertAppointmentAvailability, createAppointment, withSerializableAppointmentTransaction } from "@/lib/services/appointmentService";
import { toNumber } from "@/lib/utils";
import type { PortalAppointmentInput, PortalHealthInput, PortalRegisterInput } from "@/lib/validations/portal";
import { normalizePhone } from "@/lib/phone";

export const portalTreatmentTypes = ["Muayene", "Dolgu", "Kanal tedavisi", "İmplant", "Diş çekimi", "Protez", "Ortodonti", "Temizlik"];

async function requireActivePortalPatient(session: PatientSession) {
  const patient = await prisma.patient.findFirst({ where: { id: session.patientId, organizationId: session.organizationId, deletedAt: null }, select: { id: true } });
  if (!patient) throw new Error("Hasta hesabı aktif değil.");
}

export function buildChronicDiseases(input: PortalHealthInput) {
  const conditions = [
    input.heartDisease ? "Kalp hastalığı" : null,
    input.asthma ? "Astım" : null,
    input.diabetes ? "Diyabet" : null,
    input.hypertension ? "Hipertansiyon" : null,
    input.otherConditions?.trim() || null
  ].filter((value): value is string => Boolean(value));

  return conditions.length > 0 ? conditions.join(", ") : null;
}

export async function registerPortalPatient(input: PortalRegisterInput) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const organization = await transaction.organization.findFirst({ where: { slug: input.organizationSlug } });
        if (!organization) throw new Error("Klinik bulunamadı.");
        const phoneNormalized = normalizePhone(input.phone);
        const existing = await transaction.patient.findFirst({
          where: { organizationId: organization.id, phoneNormalized, deletedAt: null }
        });
        if (existing) return { conflict: true as const, patient: existing };

        const branch = await transaction.branch.findFirst({ where: { organizationId: organization.id }, orderBy: { createdAt: "asc" } });
        if (!branch) throw new Error("Şube bulunamadı.");

        const patient = await transaction.patient.create({
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            phoneNormalized,
            email: input.email || null,
            birthDate: input.birthDate ? new Date(input.birthDate) : null,
            allergies: input.allergies || null,
            chronicDiseases: buildChronicDiseases(input),
            medications: input.medications || null,
            notes: "Hasta portalından kayıt oldu.",
            tag: PatientTag.NEW,
            organizationId: organization.id,
            branchId: branch.id
          }
        });
        return { conflict: false as const, patient };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!retryable) throw error;
      if (attempt === 2) break;
    }
  }
  throw new Error("Hasta kaydı aynı anda değiştirildi. Lütfen yeniden deneyin.");
}

export async function updatePatientHealthInfo(session: PatientSession, input: PortalHealthInput) {
  return prisma.patient.updateMany({
    where: { id: session.patientId, organizationId: session.organizationId, deletedAt: null },
    data: {
      allergies: input.allergies?.trim() || null,
      chronicDiseases: buildChronicDiseases(input),
      medications: input.medications?.trim() || null
    }
  });
}

export async function getPortalOverview(session: PatientSession) {
  const now = new Date();
  const [patient, nextAppointment, treatments, payments] = await Promise.all([
    prisma.patient.findFirst({ where: { id: session.patientId, organizationId: session.organizationId, deletedAt: null } }),
    prisma.appointment.findFirst({
      where: {
        patientId: session.patientId,
        organizationId: session.organizationId,
        startsAt: { gte: now },
        status: { in: [AppointmentStatus.PLANNED, AppointmentStatus.PENDING_CONFIRMATION] }
      },
      include: { doctor: { select: { name: true } }, branch: { select: { name: true } } },
      orderBy: { startsAt: "asc" }
    }),
    prisma.treatment.findMany({
      where: { patientId: session.patientId, organizationId: session.organizationId },
      include: { doctor: { select: { name: true } } },
      orderBy: { performedAt: "desc" },
      take: 3
    }),
    prisma.payment.findMany({
      where: { patientId: session.patientId, organizationId: session.organizationId, type: PaymentType.INCOME },
      orderBy: { paidAt: "desc" }
    })
  ]);

  const paidTotal = payments.filter((payment) => payment.status === PaymentStatus.PAID).reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const pendingTotal = payments.filter((payment) => payment.status === PaymentStatus.PENDING).reduce((sum, payment) => sum + toNumber(payment.amount), 0);

  return { patient, nextAppointment, treatments, paidTotal, pendingTotal };
}

export async function getPatientAppointments(session: PatientSession) {
  const now = new Date();
  const appointments = await prisma.appointment.findMany({
    where: { patientId: session.patientId, organizationId: session.organizationId },
    include: { doctor: { select: { name: true } }, branch: { select: { name: true } } },
    orderBy: { startsAt: "desc" },
    take: 100
  });

  const upcoming = appointments
    .filter((appointment) => new Date(appointment.startsAt) >= now && appointment.status !== AppointmentStatus.CANCELLED)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const past = appointments.filter((appointment) => new Date(appointment.startsAt) < now || appointment.status === AppointmentStatus.CANCELLED);

  return { upcoming, past };
}

export async function getPortalDoctors(organizationId: string, branchId: string) {
  return prisma.user.findMany({
    where: {
      organizationId,
      role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] },
      active: true,
      OR: [{ branchId }, { branchId: null }]
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
}

export async function bookAppointment(session: PatientSession, input: PortalAppointmentInput) {
  await requireActivePortalPatient(session);
  const startsAt = new Date(`${input.date}T${input.time}:00+03:00`);
  if (Number.isNaN(startsAt.getTime()) || startsAt < new Date()) {
    throw new Error("Geçmiş bir tarih seçilemez.");
  }
  return createAppointment(session.organizationId, {
    patientId: session.patientId,
    doctorId: input.doctorId,
    startsAt: `${input.date}T${input.time}`,
    durationMinutes: 30,
    room: "",
    treatmentType: input.treatmentType,
    status: "PENDING_CONFIRMATION",
    notes: input.notes ? `Hasta portalından: ${input.notes}` : "Hasta portalından alındı."
  });
}

export async function cancelAppointment(session: PatientSession, appointmentId: string) {
  const cancellableStatuses: AppointmentStatus[] = [AppointmentStatus.PLANNED, AppointmentStatus.PENDING_CONFIRMATION];
  return withSerializableAppointmentTransaction(async (transaction) => {
    const now = new Date();
    const appointment = await transaction.appointment.findFirst({
      where: {
        id: appointmentId,
        patientId: session.patientId,
        organizationId: session.organizationId,
        status: { in: cancellableStatuses },
        startsAt: { gte: now },
        patient: { deletedAt: null }
      }
    });
    if (!appointment) throw new Error("Bu randevu iptal edilemez.");

    const updated = await transaction.appointment.updateMany({
      where: {
        id: appointment.id,
        patientId: session.patientId,
        organizationId: session.organizationId,
        status: { in: cancellableStatuses },
        startsAt: { gte: now },
        patient: { deletedAt: null }
      },
      data: { status: AppointmentStatus.CANCELLED }
    });
    if (updated.count !== 1) throw new Error("Randevu aynı anda değiştirildi. Lütfen yeniden deneyin.");
    return updated;
  });
}

export async function getPortalAppointmentRequests(organizationId: string) {
  return prisma.appointment.findMany({
    where: { organizationId, status: AppointmentStatus.PENDING_CONFIRMATION, patient: { deletedAt: null } },
    include: {
      patient: { select: { firstName: true, lastName: true, phone: true } },
      doctor: { select: { name: true } },
      branch: { select: { name: true } }
    },
    orderBy: { startsAt: "asc" },
    take: 50
  });
}

export async function resolvePortalAppointmentRequest(organizationId: string, appointmentId: string, decision: "approve" | "reject") {
  return withSerializableAppointmentTransaction(async (transaction) => {
    const appointment = await transaction.appointment.findFirst({
      where: { id: appointmentId, organizationId, status: AppointmentStatus.PENDING_CONFIRMATION, patient: { deletedAt: null } }
    });
    if (!appointment) throw new Error("Onay bekleyen randevu bulunamadı.");

    if (decision === "approve") {
      await assertAppointmentAvailability(transaction, {
        organizationId,
        branchId: appointment.branchId,
        doctorId: appointment.doctorId,
        startsAt: appointment.startsAt,
        durationMinutes: appointment.durationMinutes,
        room: appointment.room,
        excludeAppointmentId: appointment.id
      });
    }

    const updated = await transaction.appointment.updateMany({
      where: { id: appointment.id, organizationId, status: AppointmentStatus.PENDING_CONFIRMATION },
      data: { status: decision === "approve" ? AppointmentStatus.PLANNED : AppointmentStatus.CANCELLED }
    });
    if (updated.count !== 1) throw new Error("Randevu talebi aynı anda değiştirildi. Lütfen yeniden deneyin.");
    return updated;
  });
}

export async function getPatientTreatments(session: PatientSession) {
  const [treatments, plans] = await Promise.all([
    prisma.treatment.findMany({
      where: { patientId: session.patientId, organizationId: session.organizationId },
      include: { doctor: { select: { name: true } } },
      orderBy: { performedAt: "desc" },
      take: 50
    }),
    prisma.treatmentPlan.findMany({
      where: { patientId: session.patientId, organizationId: session.organizationId },
      include: { doctor: { select: { name: true } } },
      orderBy: { plannedAt: "desc" },
      take: 50
    })
  ]);

  return { treatments, plans };
}

export async function getPatientPayments(session: PatientSession) {
  const payments = await prisma.payment.findMany({
    where: { patientId: session.patientId, organizationId: session.organizationId, type: PaymentType.INCOME },
    include: { treatment: { select: { treatmentType: true } } },
    orderBy: { paidAt: "desc" },
    take: 100
  });

  const paidTotal = payments.filter((payment) => payment.status === PaymentStatus.PAID).reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const pendingTotal = payments.filter((payment) => payment.status === PaymentStatus.PENDING).reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const upcoming = payments
    .filter((payment) => payment.status === PaymentStatus.PENDING)
    .sort((a, b) => {
      const left = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return left - right;
    });

  return { payments, paidTotal, pendingTotal, upcoming };
}
