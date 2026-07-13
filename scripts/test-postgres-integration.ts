import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { PatientFileCategory, PatientTag, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { storePatientFile } from "../src/lib/secure-file-storage";
import { deletePatient, getPatients, restorePatient, updatePatient } from "../src/lib/services/patientService";
import { purgeExpiredTrash } from "../src/lib/services/trashService";
import { verifyAuditIntegrity } from "../src/lib/services/auditIntegrityService";
import { createRecoveryCodes, encryptMfaSecret, hashRecoveryCode, totpCode } from "../src/lib/mfa";
import { verifyMfaForLogin } from "../src/lib/services/mfaService";

const suffix = randomUUID().slice(0, 8);
const organizationSlug = `deep-test-${suffix}`;

async function main() {
  const organization = await prisma.organization.create({ data: { name: "Deep Test Clinic", slug: organizationSlug } });
  try {
    const branch = await prisma.branch.create({ data: { name: "Test Branch", city: "Istanbul", organizationId: organization.id } });
    const user = await prisma.user.create({ data: { name: "Test Owner", email: `owner-${suffix}@example.test`, passwordHash: "not-used-in-integration-test", role: Role.CLINIC_OWNER, organizationId: organization.id, branchId: branch.id } });
    const patient = await prisma.patient.create({ data: { firstName: "Derin", lastName: "Test", phone: "+90 555 000 00 01", phoneNormalized: "5550000001", birthDate: new Date("1990-01-01T00:00:00.000Z"), tag: PatientTag.ACTIVE, organizationId: organization.id, branchId: branch.id } });

    assert.equal((await getPatients(organization.id)).length, 1);
    assert.equal((await deletePatient(organization.id, patient.id, user.id, branch.id)).count, 1);
    const deleted = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    assert.ok(deleted.deletedAt);
    assert.ok(deleted.purgeAt && deleted.purgeAt > deleted.deletedAt!);
    assert.equal(deleted.deletedById, user.id);
    assert.equal((await getPatients(organization.id)).length, 0);
    assert.equal((await updatePatient(organization.id, patient.id, { firstName: "Degismez", lastName: "Test", phone: patient.phone, gender: "UNSPECIFIED", tag: "ACTIVE" })).count, 0);
    assert.equal((await prisma.auditLog.count({ where: { organizationId: organization.id, entityId: patient.id, action: "SOFT_DELETE_PATIENT" } })), 1);

    assert.equal((await restorePatient(organization.id, patient.id, user.id, branch.id)).count, 1);
    const restored = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    assert.equal(restored.deletedAt, null);
    assert.equal(restored.deletedById, user.id, "geri yükleme, son silen kullanıcı kaydını korumalı");
    assert.equal(restored.restoredById, user.id);
    assert.ok(restored.restoredAt);

    const bytes = Buffer.from("encrypted integration payload");
    const storageKey = await storePatientFile(organization.id, patient.id, { bytes, mimeType: "application/pdf", extension: "pdf", checksumSha256: "integration-checksum" });
    const patientFile = await prisma.patientFile.create({ data: { patientId: patient.id, organizationId: organization.id, category: PatientFileCategory.DOCUMENT, fileName: "test.pdf", mimeType: "application/pdf", storedMimeType: "application/pdf", size: bytes.length, storageKey, checksumSha256: "integration-checksum", data: null, deletedAt: new Date(Date.now() - 2_000), purgeAt: new Date(Date.now() - 1_000), deletedById: user.id } });

    const purgeResult = await purgeExpiredTrash(new Date());
    assert.ok(purgeResult.purgedFiles >= 1);
    assert.equal(await prisma.patientFile.count({ where: { id: patientFile.id } }), 0);
    await assert.rejects(() => access(`${process.env.FILE_STORAGE_ROOT}/${storageKey}`));
    assert.equal(await prisma.auditLog.count({ where: { organizationId: organization.id, entityId: patientFile.id, action: "PURGE_PATIENT_FILE" } }), 1);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { organizationId: organization.id, action: "PURGE_PATIENT_FILE" } });
    assert.match(audit.entryHash ?? "", /^[a-f0-9]{64}$/);
    await assert.rejects(() => prisma.auditLog.update({ where: { id: audit.id }, data: { action: "TAMPERED" } }));
    const integrity = await verifyAuditIntegrity(organization.id);
    assert.equal(integrity.valid, true, integrity.errors.join("; "));
    await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" DISABLE TRIGGER "AuditLog_immutable_update"');
    try {
      await prisma.auditLog.update({ where: { id: audit.id }, data: { previousHash: "f".repeat(64) } });
      assert.equal((await verifyAuditIntegrity(organization.id)).valid, false, "audit zinciri manipülasyonu algılanmalı");
      await prisma.auditLog.update({ where: { id: audit.id }, data: { previousHash: audit.previousHash } });
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" ENABLE TRIGGER "AuditLog_immutable_update"');
    }

    const mfaSecret = "JBSWY3DPEHPK3PXP";
    const recoveryCode = createRecoveryCodes(1)[0];
    await prisma.user.update({ where: { id: user.id }, data: {
      mfaSecretEncrypted: encryptMfaSecret(mfaSecret), mfaEnabledAt: new Date(),
      mfaRecoveryCodeHashes: [hashRecoveryCode(recoveryCode)], mfaLastUsedCounter: -1
    } });
    assert.equal(await verifyMfaForLogin(user.id), "required");
    const currentCode = totpCode(mfaSecret);
    const totpRace = await Promise.all([verifyMfaForLogin(user.id, currentCode), verifyMfaForLogin(user.id, currentCode)]);
    assert.deepEqual(totpRace.sort(), ["invalid", "verified"], "eşzamanlı aynı TOTP yalnız bir kez kullanılabilmeli");
    const recoveryRace = await Promise.all([verifyMfaForLogin(user.id, recoveryCode), verifyMfaForLogin(user.id, recoveryCode)]);
    assert.deepEqual(recoveryRace.sort(), ["invalid", "verified"], "eşzamanlı kurtarma kodu atomik olarak tüketilmeli");
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" DISABLE TRIGGER "AuditLog_immutable_update"');
    try { await prisma.organization.deleteMany({ where: { slug: organizationSlug } }); }
    finally { await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" ENABLE TRIGGER "AuditLog_immutable_update"'); }
    await prisma.$disconnect();
  }
  console.log("PostgreSQL soft-delete, restore, purge, audit ve dosya kasası entegrasyonu başarılı.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
