import { prisma } from "@/lib/prisma";
import { deleteStoredPatientFile } from "@/lib/secure-file-storage";
import { writeAuditLog } from "@/lib/services/auditLogService";

export async function purgeExpiredTrash(now = new Date()) {
  const expiredFiles = await prisma.patientFile.findMany({
    where: { deletedAt: { not: null }, purgeAt: { lte: now }, patient: { deletedAt: null } },
    select: { id: true, storageKey: true, organizationId: true, patientId: true }
  });
  const expiredPatients = await prisma.patient.findMany({
    where: { deletedAt: { not: null }, purgeAt: { lte: now } },
    select: { id: true, organizationId: true, branchId: true, files: { select: { storageKey: true } } }
  });
  const expiredStockItems = await prisma.stockItem.findMany({
    where: { deletedAt: { not: null }, purgeAt: { lte: now } },
    select: { id: true, name: true, organizationId: true, branchId: true }
  });

  for (const file of expiredFiles) {
    await deleteStoredPatientFile(file.storageKey);
    await prisma.patientFile.delete({ where: { id: file.id } });
    await writeAuditLog({ action: "PURGE_PATIENT_FILE", module: "patients", entityId: file.id, metadata: { patientId: file.patientId }, organizationId: file.organizationId });
  }
  for (const patient of expiredPatients) {
    for (const file of patient.files) await deleteStoredPatientFile(file.storageKey);
    await writeAuditLog({ action: "PURGE_PATIENT", module: "patients", entityId: patient.id, organizationId: patient.organizationId, branchId: patient.branchId });
    await prisma.patient.delete({ where: { id: patient.id } });
  }
  let purgedStockItems = 0;
  for (const item of expiredStockItems) {
    const purged = await prisma.$transaction(async (tx) => {
      const current = await tx.stockItem.findFirst({
        where: { id: item.id, deletedAt: { not: null }, purgeAt: { lte: now } },
        select: { id: true, name: true, organizationId: true, branchId: true }
      });
      if (!current) return false;
      await tx.auditLog.create({
        data: {
          action: "PURGE_STOCK_ITEM",
          module: "stocks",
          entityId: current.id,
          metadata: { name: current.name },
          organizationId: current.organizationId,
          branchId: current.branchId
        }
      });
      const deleted = await tx.stockItem.deleteMany({
        where: { id: current.id, deletedAt: { not: null }, purgeAt: { lte: now } }
      });
      if (deleted.count !== 1) throw new Error("Süresi dolan stok kaydı aynı anda değiştirildi.");
      return true;
    });
    if (purged) purgedStockItems += 1;
  }

  return { purgedPatients: expiredPatients.length, purgedFiles: expiredFiles.length, purgedStockItems };
}
