import { AppointmentStatus, Role } from "@prisma/client";
import { parseClinicDateTime } from "@/lib/clinic-time";
import { prisma } from "@/lib/prisma";
import { consumeTreatmentRecipe } from "@/lib/services/treatmentStockService";
import { assertAppointmentAvailability, isActiveSchedulingStatus, withSerializableAppointmentTransaction } from "@/lib/services/appointmentAvailability";
import type { AppointmentInput } from "@/lib/validations/appointment";

export { assertAppointmentAvailability, withSerializableAppointmentTransaction } from "@/lib/services/appointmentAvailability";
export type { AppointmentAvailabilityInput } from "@/lib/services/appointmentAvailability";

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

export async function createAppointment(organizationId: string, input: AppointmentInput) {
  const startsAt = parseClinicDateTime(input.startsAt);
  if (!startsAt) throw new Error("Geçerli bir randevu tarihi ve saati seçin.");

  return withSerializableAppointmentTransaction(async (transaction) => {
    const patient = await transaction.patient.findFirst({
      where: { id: input.patientId, organizationId, deletedAt: null },
      select: { branchId: true }
    });
    if (!patient) throw new Error("Hasta bulunamadı.");

    const doctor = await transaction.user.findFirst({
      where: {
        id: input.doctorId,
        organizationId,
        active: true,
        role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] },
        OR: [{ branchId: patient.branchId }, { branchId: null }]
      },
      select: { id: true }
    });
    if (!doctor) throw new Error("Seçilen doktor aktif değil, bu kliniğe ait değil veya hastanın şubesinde çalışmıyor.");

    if (isActiveSchedulingStatus(input.status as AppointmentStatus)) {
      await assertAppointmentAvailability(transaction, {
        organizationId,
        branchId: patient.branchId,
        doctorId: doctor.id,
        startsAt,
        durationMinutes: input.durationMinutes,
        room: input.room
      });
    }

    const appointment = await transaction.appointment.create({
      data: {
        patientId: input.patientId,
        doctorId: doctor.id,
        startsAt,
        durationMinutes: input.durationMinutes,
        room: input.room || null,
        treatmentType: input.treatmentType,
        status: input.status as AppointmentStatus,
        notes: input.notes || null,
        organizationId,
        branchId: patient.branchId
      }
    });
    if (appointment.status === AppointmentStatus.COMPLETED) {
      await consumeTreatmentRecipe(transaction, organizationId, patient.branchId, appointment.treatmentType, { appointmentId: appointment.id });
    }
    return appointment;
  });
}
