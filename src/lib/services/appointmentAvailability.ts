import { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const maximumAppointmentMinutes = 240;
const activeSchedulingStatuses: AppointmentStatus[] = [
  AppointmentStatus.PENDING_CONFIRMATION,
  AppointmentStatus.PLANNED,
  AppointmentStatus.ARRIVED,
  AppointmentStatus.COMPLETED
];

type AppointmentDatabase = Pick<Prisma.TransactionClient, "appointment">;

export type AppointmentAvailabilityInput = {
  organizationId: string;
  branchId: string;
  doctorId: string;
  startsAt: Date;
  durationMinutes: number;
  room?: string | null;
  excludeAppointmentId?: string;
};

export function isActiveSchedulingStatus(status: AppointmentStatus) {
  return activeSchedulingStatuses.includes(status);
}

export async function assertAppointmentAvailability(database: AppointmentDatabase, input: AppointmentAvailabilityInput) {
  if (Number.isNaN(input.startsAt.getTime()) || input.durationMinutes < 15 || input.durationMinutes > maximumAppointmentMinutes) {
    throw new Error("Randevu tarihi veya süresi geçersiz.");
  }

  const room = input.room?.trim() || null;
  const endAt = new Date(input.startsAt.getTime() + input.durationMinutes * 60_000);
  const possibleOverlapStart = new Date(input.startsAt.getTime() - maximumAppointmentMinutes * 60_000);
  const resources: Prisma.AppointmentWhereInput[] = [{ doctorId: input.doctorId }];
  if (room) resources.push({ branchId: input.branchId, room: { equals: room, mode: "insensitive" } });

  const candidates = await database.appointment.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
      status: { in: activeSchedulingStatuses },
      startsAt: { gte: possibleOverlapStart, lt: endAt },
      OR: resources
    },
    select: { branchId: true, doctorId: true, room: true, startsAt: true, durationMinutes: true }
  });

  const overlapping = candidates.filter((appointment) => {
    const existingEnd = new Date(appointment.startsAt.getTime() + appointment.durationMinutes * 60_000);
    return input.startsAt < existingEnd && endAt > appointment.startsAt;
  });
  if (overlapping.some((appointment) => appointment.doctorId === input.doctorId)) {
    throw new Error("Seçilen doktorun bu saat aralığında başka randevusu var.");
  }
  if (room && overlapping.some((appointment) => appointment.branchId === input.branchId && appointment.room?.trim().toLocaleLowerCase("tr-TR") === room.toLocaleLowerCase("tr-TR"))) {
    throw new Error("Seçilen oda veya koltuk bu saat aralığında dolu.");
  }
}

export async function withSerializableTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  conflictMessage: string
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!retryable) throw error;
      if (attempt === 2) break;
    }
  }
  throw new Error(conflictMessage);
}

export async function withSerializableAppointmentTransaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
  return withSerializableTransaction(operation, "Randevu aynı anda değiştirildi. Lütfen yeniden deneyin.");
}
