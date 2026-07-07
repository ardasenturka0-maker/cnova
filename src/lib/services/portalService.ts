import { AppointmentStatus, PaymentStatus, PaymentType, Role } from "@prisma/client";
import type { PatientSession } from "@/lib/patient-auth";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import type { PortalAppointmentInput } from "@/lib/validations/portal";

export const portalTreatmentTypes = ["Muayene", "Dolgu", "Kanal tedavisi", "İmplant", "Diş çekimi", "Protez", "Ortodonti", "Temizlik"];

export async function getPortalOverview(session: PatientSession) {
  const now = new Date();
  const [patient, nextAppointment, treatments, payments] = await Promise.all([
    prisma.patient.findFirst({ where: { id: session.patientId, organizationId: session.organizationId } }),
    prisma.appointment.findFirst({
      where: { patientId: session.patientId, startsAt: { gte: now }, status: AppointmentStatus.PLANNED },
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
      status: AppointmentStatus.PLANNED,
      notes: input.notes ? `Hasta portalından: ${input.notes}` : "Hasta portalından alındı.",
      organizationId: session.organizationId,
      branchId: session.branchId
    }
  });
}

export async function cancelAppointment(session: PatientSession, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patientId: session.patientId, organizationId: session.organizationId }
  });
  if (!appointment || appointment.status !== AppointmentStatus.PLANNED || new Date(appointment.startsAt) < new Date()) {
    throw new Error("Bu randevu iptal edilemez.");
  }

  return prisma.appointment.updateMany({
    where: { id: appointment.id, patientId: session.patientId },
    data: { status: AppointmentStatus.CANCELLED }
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
