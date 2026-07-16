import { AppointmentStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { consumeTreatmentRecipe } from "@/lib/services/treatmentStockService";
import type { AppointmentInput } from "@/lib/validations/appointment";

export async function getAppointments(organizationId: string, range?: { from: Date; to: Date }) {
  return prisma.appointment.findMany({
    where: { organizationId, patient: { deletedAt: null }, ...(range ? { startsAt: { gte: range.from, lt: range.to } } : {}) },
    include: {
      patient: { select: { firstName: true, lastName: true, phone: true } },
      doctor: { select: { name: true } },
      branch: { select: { name: true } }
    },
    orderBy: { startsAt: "asc" },
    take: range ? 1000 : 150
  });
}

export async function getAppointmentFormOptions(organizationId: string) {
  const [patients, doctors] = await Promise.all([
    prisma.patient.findMany({ where: { organizationId, deletedAt: null }, orderBy: { firstName: "asc" }, take: 200 }),
    prisma.user.findMany({ where: { organizationId, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, active: true }, orderBy: { name: "asc" } })
  ]);
  return { patients, doctors };
}

async function assertDoctorAvailability(organizationId: string, doctorId: string, startsAt: Date, durationMinutes: number) {
  const endAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
  const dayStart = new Date(startsAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startsAt);
  dayEnd.setHours(23, 59, 59, 999);

  const sameDayAppointments = await prisma.appointment.findMany({
    where: {
      organizationId,
      doctorId,
      status: { not: AppointmentStatus.CANCELLED },
      startsAt: { gte: dayStart, lte: dayEnd }
    }
  });

  const conflict = sameDayAppointments.find((appointment) => {
    const existingEnd = new Date(appointment.startsAt.getTime() + appointment.durationMinutes * 60 * 1000);
    return startsAt < existingEnd && endAt > appointment.startsAt;
  });

  if (conflict) {
    throw new Error("Secilen doktorun bu saat araliginda randevusu var.");
  }
}

export async function createAppointment(organizationId: string, input: AppointmentInput) {
  const [patient, doctor] = await Promise.all([
    prisma.patient.findFirst({ where: { id: input.patientId, organizationId, deletedAt: null }, select: { branchId: true } }),
    prisma.user.findFirst({ where: { id: input.doctorId, organizationId, active: true, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] } }, select: { id: true } })
  ]);

  if (!patient) {
    throw new Error("Hasta bulunamadi.");
  }
  if (!doctor) throw new Error("Seçilen doktor bulunamadı veya bu kliniğe ait değil.");

  const startsAt = new Date(input.startsAt);
  await assertDoctorAvailability(organizationId, input.doctorId, startsAt, input.durationMinutes);

  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({ data: {
      patientId: input.patientId,
      doctorId: input.doctorId,
      startsAt,
      durationMinutes: input.durationMinutes,
      room: input.room || null,
      treatmentType: input.treatmentType,
      status: input.status as AppointmentStatus,
      notes: input.notes || null,
      organizationId,
      branchId: patient.branchId
    } });
    if (appointment.status === AppointmentStatus.COMPLETED) {
      await consumeTreatmentRecipe(tx, organizationId, patient.branchId, appointment.treatmentType, { appointmentId: appointment.id });
    }
    return appointment;
  });
}
