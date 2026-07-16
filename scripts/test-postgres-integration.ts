import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { PatientFileCategory, PatientTag, Role, TreatmentStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { storePatientFile } from "../src/lib/secure-file-storage";
import { deletePatient, getPatients, restorePatient, updatePatient } from "../src/lib/services/patientService";
import { purgeExpiredTrash } from "../src/lib/services/trashService";
import { verifyAuditIntegrity } from "../src/lib/services/auditIntegrityService";
import { createRecoveryCodes, encryptMfaSecret, hashRecoveryCode, totpCode } from "../src/lib/mfa";
import { verifyMfaForLogin } from "../src/lib/services/mfaService";
import { createAppointment } from "../src/lib/services/appointmentService";
import { createPayment } from "../src/lib/services/financeService";
import { createStockItem, createStockMovement, createStockRecipe } from "../src/lib/services/stockService";
import { setTreatmentStatus } from "../src/lib/services/treatmentStockService";
import { syncMobileOperations } from "../src/lib/services/mobileSyncService";
import { mobileSyncBatchSchema } from "../src/lib/validations/mobile-sync";

const suffix = randomUUID().slice(0, 8);
const organizationSlug = `deep-test-${suffix}`;
const foreignOrganizationSlug = `foreign-test-${suffix}`;

async function main() {
  const organization = await prisma.organization.create({ data: { name: "Deep Test Clinic", slug: organizationSlug } });
  const foreignOrganization = await prisma.organization.create({ data: { name: "Foreign Test Clinic", slug: foreignOrganizationSlug } });
  try {
    const branch = await prisma.branch.create({ data: { name: "Test Branch", city: "Istanbul", organizationId: organization.id } });
    const user = await prisma.user.create({ data: { name: "Test Owner", email: `owner-${suffix}@example.test`, passwordHash: "not-used-in-integration-test", role: Role.CLINIC_OWNER, organizationId: organization.id, branchId: branch.id } });
    const patient = await prisma.patient.create({ data: { firstName: "Derin", lastName: "Test", phone: "+90 555 000 00 01", phoneNormalized: "5550000001", birthDate: new Date("1990-01-01T00:00:00.000Z"), tag: PatientTag.ACTIVE, organizationId: organization.id, branchId: branch.id } });
    const foreignBranch = await prisma.branch.create({ data: { name: "Foreign Branch", city: "Ankara", organizationId: foreignOrganization.id } });
    const foreignDoctor = await prisma.user.create({ data: { name: "Foreign Doctor", email: `foreign-${suffix}@example.test`, passwordHash: "not-used", role: Role.DOCTOR, organizationId: foreignOrganization.id, branchId: foreignBranch.id } });
    await assert.rejects(() => createAppointment(organization.id, { patientId: patient.id, doctorId: foreignDoctor.id, startsAt: "2027-01-10T10:00", durationMinutes: 30, treatmentType: "Kontrol", status: "PLANNED", room: "", notes: "" }), /bu kliniğe ait değil/);

    const secondPatient = await prisma.patient.create({ data: { firstName: "İkinci", lastName: "Hasta", phone: "+90 555 000 00 02", phoneNormalized: "5550000002", birthDate: new Date("1991-01-01T00:00:00.000Z"), tag: PatientTag.ACTIVE, organizationId: organization.id, branchId: branch.id } });
    const treatment = await prisma.treatment.create({ data: { patientId: patient.id, doctorId: user.id, treatmentType: "Dolgu", fee: 1000, status: TreatmentStatus.STARTED, organizationId: organization.id, branchId: branch.id } });
    await assert.rejects(() => createPayment(organization.id, branch.id, { patientId: secondPatient.id, treatmentId: treatment.id, type: "INCOME", amount: 100, method: "CARD", status: "PAID", isDeposit: true, listAmount: "", discountAmount: "", referralSource: "", description: "", paidAt: "", dueDate: "" }), /bu hastaya ait değil/);

    const stock = await createStockItem(organization.id, branch.id, { name: "Test Stok", category: "Sarf", currentQuantity: 7, minimumQuantity: 2, unit: "adet", supplier: "", purchasePrice: 10 });
    assert.equal(await prisma.stockMovement.count({ where: { itemId: stock.id, type: "IN", quantity: 7 } }), 1, "açılış stoku hareket kaydı üretmeli");
    await createStockMovement(organization.id, branch.id, { itemId: stock.id, type: "ADJUSTMENT", quantity: 0, note: "Sayım" });
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: stock.id } })).currentQuantity, 0);

    const automaticStock = await createStockItem(organization.id, branch.id, { name: "Otomatik Sarf", category: "Sarf", currentQuantity: 5, minimumQuantity: 1, unit: "adet", supplier: "", purchasePrice: 20 });
    await createStockRecipe(organization.id, branch.id, { treatmentType: "Dolgu", itemId: automaticStock.id, quantity: 2 });
    await setTreatmentStatus(organization.id, treatment.id, TreatmentStatus.COMPLETED);
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: automaticStock.id } })).currentQuantity, 3, "tamamlanan tedavi reçetedeki malzemeyi düşmeli");
    await setTreatmentStatus(organization.id, treatment.id, TreatmentStatus.COMPLETED);
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: automaticStock.id } })).currentQuantity, 3, "aynı durum tekrarı çift sarf üretmemeli");
    await setTreatmentStatus(organization.id, treatment.id, TreatmentStatus.STARTED);
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: automaticStock.id } })).currentQuantity, 5, "tamamlama geri alınınca sarf stoğa dönmeli");
    await createStockRecipe(organization.id, branch.id, { treatmentType: "Dolgu", itemId: automaticStock.id, quantity: 6 });
    await assert.rejects(() => setTreatmentStatus(organization.id, treatment.id, TreatmentStatus.COMPLETED), /Stok yetersiz/);
    assert.equal((await prisma.treatment.findUniqueOrThrow({ where: { id: treatment.id } })).status, TreatmentStatus.STARTED, "yetersiz stok tedaviyi tamamlamamalı");
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: automaticStock.id } })).currentQuantity, 5, "başarısız tamamlama stoğu değiştirmemeli");

    assert.equal((await getPatients(organization.id)).length, 2);
    assert.equal((await deletePatient(organization.id, patient.id, user.id, branch.id)).count, 1);
    const deleted = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    assert.ok(deleted.deletedAt);
    assert.ok(deleted.purgeAt && deleted.purgeAt > deleted.deletedAt!);
    assert.equal(deleted.deletedById, user.id);
    assert.equal((await getPatients(organization.id)).length, 1);
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

    const mobileSession = { kind: "staff" as const, userId: user.id, name: user.name, email: user.email, role: user.role, organizationId: organization.id, branchId: branch.id };
    const mobileBatch = mobileSyncBatchSchema.parse({ deviceId: `android-${suffix}`, operations: [
      { operationId: `patient-${suffix}`, entityType: "PATIENT", action: "CREATE", clientId: "local-patient-1", createdAt: new Date().toISOString(), payload: { name: "Yerel Hasta", phone: "+90 555 111 22 33", email: "yerel@example.test", tag: "ACTIVE" } },
      { operationId: `appointment-${suffix}`, entityType: "APPOINTMENT", action: "CREATE", clientId: "local-appointment-1", createdAt: new Date().toISOString(), payload: { patientId: "local-patient-1", date: "2027-02-10", time: "10:30", duration: 30, treatment: "Kontrol", doctor: user.name, room: "Koltuk 1", status: "PLANNED" } },
      { operationId: `payment-${suffix}`, entityType: "PAYMENT", action: "CREATE", clientId: "local-payment-1", createdAt: new Date().toISOString(), payload: { patientId: "local-patient-1", amount: 500, totalAmount: 1500, remainingAmount: 1000, method: "Nakit", description: "Yerel peşinat", isDeposit: true } }
    ] });
    assert.equal((await syncMobileOperations(mobileSession, mobileBatch)).filter((item) => item.status === "synced").length, 3);
    assert.equal(await prisma.patient.count({ where: { organizationId: organization.id, phoneNormalized: "5551112233" } }), 1);
    assert.equal(await prisma.appointment.count({ where: { organizationId: organization.id, treatmentType: "Kontrol" } }), 1);
    assert.equal(await prisma.payment.count({ where: { organizationId: organization.id, description: "Yerel peşinat", isDeposit: true } }), 1);
    assert.equal((await syncMobileOperations(mobileSession, mobileBatch)).filter((item) => item.status === "synced").length, 3);
    assert.equal(await prisma.mobileSyncRecord.count({ where: { organizationId: organization.id, deviceId: `android-${suffix}` } }), 3, "aynı mobil paket tekrar gönderildiğinde çift kayıt oluşturmamalı");

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
    try { await prisma.organization.deleteMany({ where: { slug: { in: [organizationSlug, foreignOrganizationSlug] } } }); }
    finally { await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" ENABLE TRIGGER "AuditLog_immutable_update"'); }
    await prisma.$disconnect();
  }
  console.log("PostgreSQL soft-delete, restore, purge, audit ve dosya kasası entegrasyonu başarılı.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
