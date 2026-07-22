import { createHash } from "node:crypto";
import { AppointmentStatus, PaymentStatus, PaymentType, Role, TaskPriority, TaskStatus, TreatmentStatus } from "@prisma/client";
import { clinicDateKey, clinicDayRange } from "@/lib/clinic-time";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";
import { toNumber } from "@/lib/utils";

type DailyTaskCandidate = {
  sourceKey: string;
  branchId: string | null;
  relatedPatientId?: string | null;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: Date;
};

function taskHref(sourceKey: string) {
  if (sourceKey.includes(":appointments")) return "/dashboard/appointments";
  if (sourceKey.includes(":payments:")) return "/dashboard/finance";
  if (sourceKey.includes(":stocks:")) return "/dashboard/stocks";
  if (sourceKey.includes(":treatments:")) return "/dashboard/treatments";
  return "/dashboard";
}

function taskBatchKey(kind: string, ids: Array<string | number>) {
  const fingerprint = createHash("sha256").update(ids.map(String).sort().join("|")).digest("hex").slice(0, 12);
  return `${kind}:${fingerprint}`;
}

function canAccessDailyTask(role: Role, sourceKey: string) {
  if (sourceKey.includes(":appointments")) return canAccess(role, "appointments");
  if (sourceKey.includes(":payments:")) return canAccess(role, "finance");
  if (sourceKey.includes(":stocks:")) return canAccess(role, "stocks");
  if (sourceKey.includes(":treatments:")) return canAccess(role, "treatments");
  return false;
}

/**
 * Inspects actionable clinic state and materializes one deduplicated task per
 * clinic day. Re-running this function is safe; DONE tasks stay done and
 * resolved findings are hidden automatically.
 */
export async function ensureDailyClinicTasks(organizationId: string, branchId?: string | null, now = new Date()) {
  const dateKey = clinicDateKey(now);
  const scopeKey = branchId ?? "all";
  const scope = branchId ? { branchId } : {};
  const prefix = `clinic-daily:${scopeKey}:${dateKey}:`;
  const allScopePrefix = `clinic-daily:${scopeKey}:`;
  const { from, to } = clinicDayRange(dateKey);
  const dueDate = new Date(to.getTime() - 1);

  const [appointments, pendingPayments, stockItems, unfinishedTreatments] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        organizationId,
        ...scope,
        startsAt: { gte: from, lt: to },
        status: { in: [AppointmentStatus.PENDING_CONFIRMATION, AppointmentStatus.PLANNED, AppointmentStatus.ARRIVED, AppointmentStatus.NO_SHOW] },
        patient: { deletedAt: null }
      },
      select: { id: true, status: true },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }]
    }),
    prisma.payment.findMany({
      where: {
        organizationId,
        ...scope,
        type: PaymentType.INCOME,
        status: PaymentStatus.PENDING,
        dueDate: { lt: to },
        patient: { deletedAt: null }
      },
      select: {
        id: true,
        amount: true,
        dueDate: true,
        patientId: true,
        patient: { select: { firstName: true, lastName: true } }
      },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }]
    }),
    prisma.stockItem.findMany({
      where: { organizationId, ...scope, deletedAt: null },
      select: { id: true, name: true, currentQuantity: true, minimumQuantity: true, unit: true, branchId: true },
      orderBy: [{ currentQuantity: "asc" }, { id: "asc" }]
    }),
    prisma.treatment.findMany({
      where: {
        organizationId,
        ...scope,
        status: TreatmentStatus.STARTED,
        performedAt: { lt: from },
        patient: { deletedAt: null }
      },
      select: {
        id: true,
        treatmentType: true,
        performedAt: true,
        patientId: true,
        patient: { select: { firstName: true, lastName: true } }
      },
      orderBy: [{ performedAt: "asc" }, { id: "asc" }]
    })
  ]);

  const candidates: DailyTaskCandidate[] = [];
  if (appointments.length) {
    const confirmationCount = appointments.filter((item) => item.status === AppointmentStatus.PENDING_CONFIRMATION).length;
    candidates.push({
      sourceKey: `${prefix}${taskBatchKey("appointments", appointments.map((item) => `${item.id}:${item.status}`))}`,
      branchId: branchId ?? null,
      title: `Bugünkü ${appointments.length} randevuyu hazırla`,
      description: confirmationCount
        ? `${confirmationCount} randevu ayrıca onay bekliyor. Günlük akışı, hasta notlarını ve koltuk hazırlığını kontrol edin.`
        : "Günlük akışı, hasta notlarını ve koltuk hazırlığını kontrol edin.",
      priority: confirmationCount ? TaskPriority.HIGH : TaskPriority.MEDIUM,
      dueDate
    });
  }

  if (pendingPayments.length) {
    const overdueCount = pendingPayments.filter((payment) => payment.dueDate && payment.dueDate < from).length;
    const total = pendingPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
    const patientNames = pendingPayments.slice(0, 3).map((payment) => payment.patient ? `${payment.patient.firstName} ${payment.patient.lastName}`.trim() : "Hasta");
    candidates.push({
      sourceKey: `${prefix}${taskBatchKey("payments", pendingPayments.map((payment) => `${payment.id}:${payment.amount}:${payment.dueDate?.toISOString() ?? ""}`))}`,
      branchId: branchId ?? null,
      relatedPatientId: pendingPayments.length === 1 ? pendingPayments[0]?.patientId : null,
      title: `${pendingPayments.length} bekleyen tahsilatı kontrol et`,
      description: `${overdueCount} gecikmiş kayıt · ${Math.round(total * 100) / 100} TL açık bakiye${patientNames.length ? ` · ${patientNames.join(", ")}${pendingPayments.length > patientNames.length ? "…" : ""}` : ""}.`,
      priority: overdueCount ? TaskPriority.HIGH : TaskPriority.MEDIUM,
      dueDate
    });
  }

  const criticalStocks = stockItems.filter((stock) => stock.currentQuantity <= stock.minimumQuantity);
  if (criticalStocks.length) {
    const emptyCount = criticalStocks.filter((item) => item.currentQuantity === 0).length;
    const stockNames = criticalStocks.slice(0, 4).map((item) => `${item.name} (${item.currentQuantity} ${item.unit})`);
    candidates.push({
      sourceKey: `${prefix}${taskBatchKey("stocks", criticalStocks.map((item) => `${item.id}:${item.currentQuantity}:${item.minimumQuantity}`))}`,
      branchId: branchId ?? null,
      title: `${criticalStocks.length} kritik stok kalemini tamamla`,
      description: `${emptyCount} ürün tamamen tükendi · ${stockNames.join(", ")}${criticalStocks.length > stockNames.length ? "…" : ""}.`,
      priority: emptyCount ? TaskPriority.URGENT : TaskPriority.HIGH,
      dueDate
    });
  }

  if (unfinishedTreatments.length) {
    const treatmentNames = unfinishedTreatments.slice(0, 3).map((treatment) => `${treatment.patient.firstName} ${treatment.patient.lastName} · ${treatment.treatmentType}`);
    candidates.push({
      sourceKey: `${prefix}${taskBatchKey("treatments", unfinishedTreatments.map((treatment) => `${treatment.id}:${treatment.performedAt.toISOString()}`))}`,
      branchId: branchId ?? null,
      relatedPatientId: unfinishedTreatments.length === 1 ? unfinishedTreatments[0]?.patientId : null,
      title: `${unfinishedTreatments.length} tedavinin gelişimini güncelle`,
      description: `${treatmentNames.join(", ")}${unfinishedTreatments.length > treatmentNames.length ? "…" : ""}. Önceki günden açık kayıtları ilerletin veya tamamlayın.`,
      priority: TaskPriority.MEDIUM,
      dueDate
    });
  }

  const activeKeys = candidates.map((candidate) => candidate.sourceKey);
  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: {
        organizationId,
        sourceKey: { startsWith: allScopePrefix, not: { startsWith: prefix } },
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] }
      },
      data: { status: TaskStatus.CANCELLED }
    });
    await tx.task.updateMany({
      where: {
        organizationId,
        sourceKey: activeKeys.length ? { startsWith: prefix, notIn: activeKeys } : { startsWith: prefix },
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] }
      },
      data: { status: TaskStatus.CANCELLED }
    });
    for (const candidate of candidates) {
      await tx.task.upsert({
        where: { organizationId_sourceKey: { organizationId, sourceKey: candidate.sourceKey } },
        create: {
          organizationId,
          branchId: candidate.branchId,
          relatedPatientId: candidate.relatedPatientId ?? null,
          sourceKey: candidate.sourceKey,
          title: candidate.title,
          description: candidate.description,
          priority: candidate.priority,
          status: TaskStatus.TODO,
          dueDate: candidate.dueDate
        },
        update: {
          branchId: candidate.branchId,
          relatedPatientId: candidate.relatedPatientId ?? null,
          title: candidate.title,
          description: candidate.description,
          priority: candidate.priority,
          dueDate: candidate.dueDate
        }
      });
    }
    if (activeKeys.length) {
      await tx.task.updateMany({
        where: { organizationId, sourceKey: { in: activeKeys }, status: TaskStatus.CANCELLED },
        data: { status: TaskStatus.TODO }
      });
    }
  });

  return { dateKey, prefix, generated: candidates.length };
}

export async function getDailyClinicTasks(organizationId: string, branchId: string | null | undefined, role: Role, now = new Date()) {
  const { prefix } = await ensureDailyClinicTasks(organizationId, branchId, now);
  const rows = await prisma.task.findMany({
    where: {
      organizationId,
      sourceKey: { startsWith: prefix },
      status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] }
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    take: 20
  });
  const priorityOrder: Record<TaskPriority, number> = {
    [TaskPriority.URGENT]: 0,
    [TaskPriority.HIGH]: 1,
    [TaskPriority.MEDIUM]: 2,
    [TaskPriority.LOW]: 3
  };
  return rows
    .filter((task) => canAccessDailyTask(role, task.sourceKey ?? ""))
    .sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority])
    .map((task) => ({ ...task, href: taskHref(task.sourceKey ?? "") }));
}

export async function completeDailyClinicTask(organizationId: string, taskId: string, branchId: string | null | undefined, role: Role, now = new Date()) {
  const dateKey = clinicDateKey(now);
  const prefix = `clinic-daily:${branchId ?? "all"}:${dateKey}:`;
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      organizationId,
      sourceKey: { startsWith: prefix },
      status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] }
    },
    select: { sourceKey: true }
  });
  if (!task?.sourceKey || !canAccessDailyTask(role, task.sourceKey)) throw new Error("Günlük görev bulunamadı veya bu görev için yetkiniz yok.");
  const result = await prisma.task.updateMany({
    where: {
      id: taskId,
      organizationId,
      sourceKey: task.sourceKey,
      status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] }
    },
    data: { status: TaskStatus.DONE }
  });
  if (result.count !== 1) throw new Error("Günlük görev bulunamadı veya daha önce tamamlandı.");
  return result;
}
