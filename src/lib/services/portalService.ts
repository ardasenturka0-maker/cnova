import { AppointmentStatus, PatientTag, PaymentStatus, PaymentType, Role } from "@prisma/client";
import type { PatientSession } from "@/lib/patient-auth";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import type { PortalAppointmentInput, PortalHealthInput, PortalRegisterInput } from "@/lib/validations/portal";

export const portalTreatmentTypes = ["Muayene", "Dolgu", "Kanal tedavisi", "İmplant", "Diş çekimi", "Protez", "Ortodonti", "Temizlik"];

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
  const { findPatientByPhone } = await import("@/lib/patient-auth");
  const existing = await findPatientByPhone(input.phone);
  if (existing) {
    return { conflict: true as const, patient: existing };
  }

  const organization = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!organization) throw new Error("Organizasyon bulunamadı.");
  const branch = await prisma.branch.findFirst({ where: { organizationId: organization.id }, orderBy: { createdAt: "asc" } });
  if (!branch) throw new Error("Şube bulunamadı.");

  const patient = await prisma.patient.create({
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      birthDate: input.birthDate ? new Date(input.birthDate) : null,
      allergies: input.allergies?.trim() || null,
      chronicDiseases: buildChronicDiseases(input),
      medications: input.medications?.trim() || null,
      notes: "Hasta portalından kayıt oldu.",
      tag: PatientTag.NEW,
      organizationId: organization.id,
      branchId: branch.id
    }
  });

  return { conflict: false as const, patient };
}

export async function updatePatientHealthInfo(session: PatientSession, input: PortalHealthInput) {
  return prisma.patient.updateMany({
    where: { id: session.patientId, organizationId: session.organizationId },
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
        startsAt: { gte: now },
        status: { in: [AppointmentStatus.PLANNED, AppointmentStatus.PENDING_CONFIRMATION] }
      },
      include: { doctor: { select: { name: true } }, branch: { select: { name: true } } },
      orderBy: { startsAt: "asc" }
    }),
    prisma.treatment.findMany({
      where: { patientId: session.patientId },
      include: { doctor: { select: { name: true } } },
      orderBy: { performedAt: "desc" },
      take: 3
    }),
    prisma.payment.findMany({
      where: { patientId: session.patientId, type: PaymentType.INCOME },
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
    where: { patientId: session.patientId },
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

export async function getPortalDoctors(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId, role: Role.DOCTOR, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
}

export async function bookAppointment(session: PatientSession, input: PortalAppointmentInput) {
  const doctor = await prisma.user.findFirst({
    where: { id: input.doctorId, organizationId: session.organizationId, role: Role.DOCTOR, active: true },
    select: { id: true }
  });
  if (!doctor) {
    throw new Error("Doktor bulunamadı.");
  }

  const startsAt = new Date(`${input.date}T${input.time}`);
  if (Number.isNaN(startsAt.getTime()) || startsAt < new Date()) {
    throw new Error("Geçmiş bir tarih seçilemez.");
  }

  return prisma.appointment.create({
    data: {
      patientId: session.patientId,
      doctorId: doctor.id,
      startsAt,
      durationMinutes: 30,
      treatmentType: input.treatmentType,
      status: AppointmentStatus.PENDING_CONFIRMATION,
      notes: input.notes ? `Hasta portalından: ${input.notes}` : "Hasta portalından alındı.",
      organizationId: session.organizationId,
      branchId: session.branchId
    }
  });
}

export async function cancelAppointment(session: PatientSession, appointmentId: string) {
  const cancellableStatuses: AppointmentStatus[] = [AppointmentStatus.PLANNED, AppointmentStatus.PENDING_CONFIRMATION];
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patientId: session.patientId, organizationId: session.organizationId }
  });
  if (!appointment || !cancellableStatuses.includes(appointment.status) || new Date(appointment.startsAt) < new Date()) {
    throw new Error("Bu randevu iptal edilemez.");
  }

  return prisma.appointment.updateMany({
    where: { id: appointment.id, patientId: session.patientId },
    data: { status: AppointmentStatus.CANCELLED }
  });
}

export async function getPortalAppointmentRequests(organizationId: string) {
  return prisma.appointment.findMany({
    where: { organizationId, status: AppointmentStatus.PENDING_CONFIRMATION },
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
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, organizationId, status: AppointmentStatus.PENDING_CONFIRMATION }
  });
  if (!appointment) {
    throw new Error("Onay bekleyen randevu bulunamadı.");
  }

  return prisma.appointment.updateMany({
    where: { id: appointment.id, organizationId },
    data: { status: decision === "approve" ? AppointmentStatus.PLANNED : AppointmentStatus.CANCELLED }
  });
}

export async function getPatientTreatments(session: PatientSession) {
  const [treatments, plans] = await Promise.all([
    prisma.treatment.findMany({
      where: { patientId: session.patientId },
      include: { doctor: { select: { name: true } } },
      orderBy: { performedAt: "desc" },
      take: 50
    }),
    prisma.treatmentPlan.findMany({
      where: { patientId: session.patientId },
      include: { doctor: { select: { name: true } } },
      orderBy: { plannedAt: "desc" },
      take: 50
    })
  ]);

  return { treatments, plans };
}

export async function getPatientPayments(session: PatientSession) {
  const payments = await prisma.payment.findMany({
    where: { patientId: session.patientId, type: PaymentType.INCOME },
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
