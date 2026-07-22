import { TreatmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CompletedTreatmentHistoryOptions = {
  patientId?: string;
  branchId?: string | null;
  take?: number;
  skip?: number;
};

/** Canonical source for patient and clinic-wide past-treatment views. */
export async function getCompletedTreatmentHistory(
  organizationId: string,
  options: CompletedTreatmentHistoryOptions = {}
) {
  const take = Math.max(1, Math.min(500, options.take ?? 100));
  const skip = Math.max(0, options.skip ?? 0);
  return prisma.treatment.findMany({
    where: {
      organizationId,
      status: TreatmentStatus.COMPLETED,
      patient: { deletedAt: null },
      ...(options.patientId ? { patientId: options.patientId } : {}),
      ...(options.branchId ? { branchId: options.branchId } : {})
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      doctor: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      payments: { orderBy: { paidAt: "desc" } }
    },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
    skip,
    take
  });
}

export async function countCompletedTreatmentHistory(
  organizationId: string,
  options: Pick<CompletedTreatmentHistoryOptions, "patientId" | "branchId"> = {}
) {
  return prisma.treatment.count({
    where: {
      organizationId,
      status: TreatmentStatus.COMPLETED,
      patient: { deletedAt: null },
      ...(options.patientId ? { patientId: options.patientId } : {}),
      ...(options.branchId ? { branchId: options.branchId } : {})
    }
  });
}
