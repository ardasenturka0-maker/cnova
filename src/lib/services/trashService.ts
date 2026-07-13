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

  return { purgedPatients: expiredPatients.length, purgedFiles: expiredFiles.length };
}
