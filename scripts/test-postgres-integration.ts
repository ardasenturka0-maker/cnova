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
import { createStockItem, createStockMovement, createStockRecipe, getDeletedStockItems, getStocks, restoreStockItem, softDeleteStockItem } from "../src/lib/services/stockService";
import { setAppointmentStatus, setTreatmentStatus, updateTreatmentRecord } from "../src/lib/services/treatmentStockService";
import { getCompletedTreatmentHistory } from "../src/lib/services/treatmentHistoryService";
import { completeDailyClinicTask, getDailyClinicTasks } from "../src/lib/services/dailyTaskService";
import { getDashboardMetrics } from "../src/lib/services/reportService";
import { getMobileSnapshot, syncMobileOperations } from "../src/lib/services/mobileSyncService";
import { cancelAppointment } from "../src/lib/services/portalService";
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

    const appointmentRace = await Promise.allSettled([
      createAppointment(organization.id, { patientId: patient.id, doctorId: user.id, startsAt: "2027-01-10T11:00", durationMinutes: 30, treatmentType: "Kontrol", status: "PLANNED", room: "Yarış Koltuğu", notes: "eşzamanlı-a" }),
      createAppointment(organization.id, { patientId: patient.id, doctorId: user.id, startsAt: "2027-01-10T11:00", durationMinutes: 30, treatmentType: "Kontrol", status: "PLANNED", room: "Yarış Koltuğu", notes: "eşzamanlı-b" })
    ]);
    assert.equal(appointmentRace.filter((result) => result.status === "fulfilled").length, 1, "eşzamanlı çakışan randevulardan yalnız biri yazılmalı");
    assert.equal(appointmentRace.filter((result) => result.status === "rejected").length, 1, "ikinci eşzamanlı randevu çakışma olarak reddedilmeli");
    assert.equal(await prisma.appointment.count({ where: { organizationId: organization.id, startsAt: new Date("2027-01-10T08:00:00.000Z"), doctorId: user.id } }), 1);
    const cancelledConflict = await prisma.appointment.create({ data: {
      patientId: patient.id, doctorId: user.id, startsAt: new Date("2027-01-10T08:00:00.000Z"), durationMinutes: 30,
      treatmentType: "Kontrol", status: "CANCELLED", room: "Yeniden Aktivasyon", organizationId: organization.id, branchId: branch.id
    } });
    await assert.rejects(() => setAppointmentStatus(organization.id, cancelledConflict.id, "PLANNED"), /başka randevusu|dolu/);
    assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: cancelledConflict.id } })).status, "CANCELLED", "çakışan iptal randevusu yeniden etkinleşmemeli");

    const organizationSecondBranch = await prisma.branch.create({ data: { name: "Second Test Branch", city: "Izmir", organizationId: organization.id } });
    const organizationSecondDoctor = await prisma.user.create({ data: { name: "Second Doctor", email: `second-doctor-${suffix}@example.test`, passwordHash: "not-used", role: Role.DOCTOR, organizationId: organization.id, branchId: organizationSecondBranch.id } });
    const organizationSecondPatient = await prisma.patient.create({ data: { firstName: "Şube", lastName: "Hastası", phone: "+90 555 000 00 03", phoneNormalized: "5550000003", birthDate: new Date("1992-01-01T00:00:00.000Z"), tag: PatientTag.ACTIVE, organizationId: organization.id, branchId: organizationSecondBranch.id } });
    await createAppointment(organization.id, { patientId: organizationSecondPatient.id, doctorId: organizationSecondDoctor.id, startsAt: "2027-01-10T11:00", durationMinutes: 30, treatmentType: "Kontrol", status: "PLANNED", room: "Yarış Koltuğu", notes: "farklı şube" });
    assert.equal(await prisma.appointment.count({ where: { organizationId: organization.id, startsAt: new Date("2027-01-10T08:00:00.000Z"), room: "Yarış Koltuğu" } }), 2, "aynı koltuk adı farklı şubelerde bağımsız olmalı");

    const secondPatient = await prisma.patient.create({ data: { firstName: "İkinci", lastName: "Hasta", phone: "+90 555 000 00 02", phoneNormalized: "5550000002", birthDate: new Date("1991-01-01T00:00:00.000Z"), tag: PatientTag.ACTIVE, organizationId: organization.id, branchId: branch.id } });
    const treatment = await prisma.treatment.create({ data: { patientId: patient.id, doctorId: user.id, treatmentType: "Dolgu", fee: 1000, status: TreatmentStatus.STARTED, organizationId: organization.id, branchId: branch.id } });
    await assert.rejects(() => createPayment(organization.id, branch.id, { patientId: secondPatient.id, treatmentId: treatment.id, type: "INCOME", amount: 100, method: "CARD", status: "PAID", isDeposit: true, listAmount: "", discountAmount: "", referralSource: "", description: "", paidAt: "", dueDate: "" }), /bu hastaya ait değil/);
    await assert.rejects(() => createPayment(organization.id, branch.id, { patientId: patient.id, treatmentId: treatment.id, type: "INCOME", amount: 901, method: "CARD", status: "PAID", isDeposit: false, listAmount: 1000, discountAmount: 100, referralSource: "", description: "", paidAt: "", dueDate: "" }), /indirim sonrası son tutardan büyük/);

    const stock = await createStockItem(organization.id, branch.id, { name: "Test Stok", category: "Sarf", currentQuantity: 7, minimumQuantity: 2, unit: "adet", supplier: "", purchasePrice: 10 });
    assert.equal(await prisma.stockMovement.count({ where: { itemId: stock.id, type: "IN", quantity: 7 } }), 1, "açılış stoku hareket kaydı üretmeli");
    await createStockMovement(organization.id, branch.id, { itemId: stock.id, type: "ADJUSTMENT", quantity: 0, note: "Sayım" });
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: stock.id } })).currentQuantity, 0);

    const secondBranchStock = await createStockItem(organization.id, organizationSecondBranch.id, { name: "Şubeye Özel Stok", category: "Sarf", currentQuantity: 4, minimumQuantity: 1, unit: "adet", supplier: "", purchasePrice: 8 });
    assert.equal((await getStocks(organization.id, branch.id)).some((item) => item.id === secondBranchStock.id), false, "stok listesi başka şubenin ürününü göstermemeli");
    assert.equal((await getStocks(organization.id)).some((item) => item.id === secondBranchStock.id), true, "şubesiz servis çağrısı geriye dönük olarak organizasyon görünümünü korumalı");
    await assert.rejects(() => createStockMovement(organization.id, branch.id, { itemId: secondBranchStock.id, type: "IN", quantity: 1, note: "Yetkisiz şube denemesi" }), /bulunamad/i);
    await assert.rejects(() => softDeleteStockItem(organization.id, secondBranchStock.id, user.id, branch.id), /bulunamadı/);
    await softDeleteStockItem(organization.id, secondBranchStock.id, user.id, organizationSecondBranch.id);
    assert.equal((await getDeletedStockItems(organization.id, { branchId: branch.id })).items.some((item) => item.id === secondBranchStock.id), false, "stok çöpü başka şubenin ürününü göstermemeli");
    assert.equal((await getDeletedStockItems(organization.id, { branchId: organizationSecondBranch.id })).items.some((item) => item.id === secondBranchStock.id), true, "silinen stok kendi şubesinin çöpünde görünmeli");
    await assert.rejects(() => restoreStockItem(organization.id, secondBranchStock.id, user.id, branch.id), /bulunamadı/);
    await restoreStockItem(organization.id, secondBranchStock.id, user.id, organizationSecondBranch.id);

    const trashStock = await createStockItem(organization.id, branch.id, { name: "Geri Dönüşüm Stoku", category: "Sarf", currentQuantity: 9, minimumQuantity: 2, unit: "adet", supplier: "Test", purchasePrice: 12 });
    const trashRecipe = await createStockRecipe(organization.id, branch.id, { treatmentType: "Arşiv Reçetesi", itemId: trashStock.id, quantity: 2 });
    const trashOffer = await prisma.stockOffer.create({ data: { itemId: trashStock.id, seller: "Test Satıcı", unitPrice: 11, shippingPrice: 1, productUrl: "https://example.test/product", inStock: true, organizationId: organization.id, branchId: branch.id } });
    await softDeleteStockItem(organization.id, trashStock.id, user.id);
    assert.equal(await prisma.auditLog.count({ where: { organizationId: organization.id, entityId: trashStock.id, action: "SOFT_DELETE_STOCK_ITEM" } }), 1, "stok silme denetim izi üretmeli");
    assert.equal((await getStocks(organization.id)).some((item) => item.id === trashStock.id), false, "silinen stok aktif listeden çıkmalı");
    const { items: deletedStocks } = await getDeletedStockItems(organization.id);
    const deletedTrashStock = deletedStocks.find((item) => item.id === trashStock.id);
    assert.ok(deletedTrashStock?.deletedAt && deletedTrashStock.purgeAt, "silinen stok çöp kutusuna düşmeli");
    assert.equal(deletedTrashStock?.branchId, branch.id, "çöp kaydı özgün şubesini korumalı");
    assert.equal(deletedTrashStock?.recipes.some((recipe) => recipe.id === trashRecipe.id), true, "stok reçetesi çöp sırasında korunmalı");
    assert.equal(deletedTrashStock?.offers.some((offer) => offer.id === trashOffer.id), true, "stok teklifi çöp sırasında korunmalı");
    assert.equal(deletedTrashStock?.movements.length, 1, "stok hareketleri çöp sırasında korunmalı");
    await assert.rejects(() => restoreStockItem(foreignOrganization.id, trashStock.id, user.id), /bulunamadı/);
    await restoreStockItem(organization.id, trashStock.id, user.id);
    assert.equal(await prisma.auditLog.count({ where: { organizationId: organization.id, entityId: trashStock.id, action: "RESTORE_STOCK_ITEM" } }), 1, "stok geri yükleme denetim izi üretmeli");
    assert.equal((await getStocks(organization.id)).some((item) => item.id === trashStock.id), true, "geri yüklenen stok aktif listeye dönmeli");
    assert.equal(await prisma.stockRecipe.count({ where: { id: trashRecipe.id, itemId: trashStock.id } }), 1, "geri yükleme reçete ilişkisini korumalı");
    assert.equal(await prisma.stockOffer.count({ where: { id: trashOffer.id, itemId: trashStock.id } }), 1, "geri yükleme teklif ilişkisini korumalı");

    const rollbackStock = await createStockItem(organization.id, branch.id, { name: "Audit Rollback Stoku", category: "Sarf", currentQuantity: 1, minimumQuantity: 0, unit: "adet", supplier: "", purchasePrice: 1 });
    await assert.rejects(() => softDeleteStockItem(organization.id, rollbackStock.id, "missing-audit-user"));
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: rollbackStock.id } })).deletedAt, null, "audit yazılamazsa stok silme bütünüyle geri alınmalı");

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

    const oldRecipeStock = await createStockItem(organization.id, branch.id, { name: "Eski Reçete Sarfı", category: "Sarf", currentQuantity: 4, minimumQuantity: 1, unit: "adet", supplier: "", purchasePrice: 5 });
    const newRecipeStock = await createStockItem(organization.id, branch.id, { name: "Yeni Reçete Sarfı", category: "Sarf", currentQuantity: 5, minimumQuantity: 1, unit: "adet", supplier: "", purchasePrice: 5 });
    await createStockRecipe(organization.id, branch.id, { treatmentType: "Güncellenecek Eski", itemId: oldRecipeStock.id, quantity: 1 });
    await createStockRecipe(organization.id, branch.id, { treatmentType: "Güncellenecek Yeni", itemId: newRecipeStock.id, quantity: 2 });
    const editableTreatment = await prisma.treatment.create({ data: { patientId: patient.id, doctorId: user.id, treatmentType: "Güncellenecek Eski", fee: 1200, status: TreatmentStatus.STARTED, organizationId: organization.id, branchId: branch.id } });
    await setTreatmentStatus(organization.id, editableTreatment.id, TreatmentStatus.COMPLETED);
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: oldRecipeStock.id } })).currentQuantity, 3);
    const updatedTreatmentInput = {
      patientId: patient.id, doctorId: user.id, toothNumber: "14", treatmentType: "Güncellenecek Yeni", description: "Kontrollü güncelleme", fee: 1300,
      downPayment: 300, installmentCount: 2, firstInstallmentDate: "2027-01-10", paymentPlanNote: "İki taksit", status: TreatmentStatus.COMPLETED, date: "2027-01-10"
    };
    await updateTreatmentRecord(organization.id, editableTreatment.id, updatedTreatmentInput);
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: oldRecipeStock.id } })).currentQuantity, 4, "tedavi türü değişince eski reçete tek kez iade edilmeli");
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: newRecipeStock.id } })).currentQuantity, 3, "yeni reçete tek kez sarf edilmeli");
    await updateTreatmentRecord(organization.id, editableTreatment.id, updatedTreatmentInput);
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: oldRecipeStock.id } })).currentQuantity, 4, "aynı güncelleme eski reçeteyi yeniden iade etmemeli");
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: newRecipeStock.id } })).currentQuantity, 3, "aynı güncelleme yeni reçeteyi yeniden sarf etmemeli");
    await updateTreatmentRecord(organization.id, editableTreatment.id, { ...updatedTreatmentInput, status: TreatmentStatus.STARTED });
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: newRecipeStock.id } })).currentQuantity, 5, "tamamlama geri alınınca güncel reçete tek kez iade edilmeli");
    const completedHistoryTreatment = await prisma.treatment.create({ data: { patientId: patient.id, doctorId: user.id, treatmentType: "Geçmiş Tedavi Kanıtı", fee: 900, status: TreatmentStatus.COMPLETED, organizationId: organization.id, branchId: branch.id } });
    const patientHistory = await getCompletedTreatmentHistory(organization.id, { patientId: patient.id });
    assert.equal(patientHistory.some((item) => item.id === completedHistoryTreatment.id), true, "tamamlanan tedavi hasta geçmişine otomatik düşmeli");
    assert.equal((await getCompletedTreatmentHistory(foreignOrganization.id, { patientId: patient.id })).length, 0, "geçmiş tedavi sorgusu tenant sınırını aşmamalı");

    const raceStock = await createStockItem(organization.id, branch.id, { name: "Durum Yarışı Sarfı", category: "Sarf", currentQuantity: 5, minimumQuantity: 1, unit: "adet", supplier: "", purchasePrice: 20 });
    await createStockRecipe(organization.id, branch.id, { treatmentType: "Durum Yarışı", itemId: raceStock.id, quantity: 2 });
    const raceTreatment = await prisma.treatment.create({ data: {
      patientId: patient.id, doctorId: user.id, treatmentType: "Durum Yarışı", fee: 750,
      status: TreatmentStatus.STARTED, organizationId: organization.id, branchId: branch.id
    } });
    await Promise.allSettled([
      setTreatmentStatus(organization.id, raceTreatment.id, TreatmentStatus.COMPLETED),
      setTreatmentStatus(organization.id, raceTreatment.id, TreatmentStatus.CANCELLED)
    ]);
    const treatmentAfterRace = await prisma.treatment.findUniqueOrThrow({ where: { id: raceTreatment.id } });
    const stockAfterTreatmentRace = await prisma.stockItem.findUniqueOrThrow({ where: { id: raceStock.id } });
    const treatmentRaceMovements = await prisma.stockMovement.findMany({ where: { treatmentId: raceTreatment.id, itemId: raceStock.id } });
    const treatmentOutstanding = treatmentRaceMovements.reduce((total, movement) => total + (movement.type === "OUT" ? movement.quantity : movement.type === "IN" ? -movement.quantity : 0), 0);
    assert.equal(treatmentOutstanding, treatmentAfterRace.status === TreatmentStatus.COMPLETED ? 2 : 0, "eşzamanlı tedavi durumu ile sarf hareketi tutarlı kalmalı");
    assert.equal(stockAfterTreatmentRace.currentQuantity, treatmentAfterRace.status === TreatmentStatus.COMPLETED ? 3 : 5, "eşzamanlı tedavi durumu ile stok miktarı tutarlı kalmalı");

    const appointmentRaceStock = await createStockItem(organization.id, branch.id, { name: "Randevu Yarışı Sarfı", category: "Sarf", currentQuantity: 4, minimumQuantity: 1, unit: "adet", supplier: "", purchasePrice: 20 });
    await createStockRecipe(organization.id, branch.id, { treatmentType: "Randevu Yarışı", itemId: appointmentRaceStock.id, quantity: 1 });
    const statusRaceAppointment = await prisma.appointment.create({ data: {
      patientId: patient.id, doctorId: user.id, startsAt: new Date("2027-05-10T07:00:00.000Z"), durationMinutes: 30,
      treatmentType: "Randevu Yarışı", status: "PLANNED", room: "Durum Koltuğu", organizationId: organization.id, branchId: branch.id
    } });
    const patientSession = { kind: "patient" as const, patientId: patient.id, name: "Derin Test", organizationId: organization.id, branchId: branch.id };
    await Promise.allSettled([
      setAppointmentStatus(organization.id, statusRaceAppointment.id, "COMPLETED"),
      cancelAppointment(patientSession, statusRaceAppointment.id)
    ]);
    assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: statusRaceAppointment.id } })).status, "COMPLETED", "portal iptali eşzamanlı tamamlamayı stoktan koparmamalı");
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: appointmentRaceStock.id } })).currentQuantity, 3, "tamamlanan randevunun sarfı eşzamanlı portal iptalinde korunmalı");

    assert.equal((await getPatients(organization.id)).length, 3);
    assert.equal((await deletePatient(organization.id, patient.id, user.id, branch.id)).count, 1);
    const deleted = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    assert.ok(deleted.deletedAt);
    assert.ok(deleted.purgeAt && deleted.purgeAt > deleted.deletedAt!);
    assert.equal(deleted.deletedById, user.id);
    assert.equal((await getPatients(organization.id)).length, 2);
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
    const expiredStock = await createStockItem(organization.id, branch.id, { name: "Süresi Dolan Stok", category: "Sarf", currentQuantity: 2, minimumQuantity: 1, unit: "adet", supplier: "", purchasePrice: 3 });
    const expiredRecipe = await createStockRecipe(organization.id, branch.id, { treatmentType: "Silinecek Reçete", itemId: expiredStock.id, quantity: 1 });
    await prisma.stockItem.update({ where: { id: expiredStock.id }, data: { deletedAt: new Date(Date.now() - 2_000), purgeAt: new Date(Date.now() - 1_000), deletedById: user.id } });

    const purgeResult = await purgeExpiredTrash(new Date());
    assert.ok(purgeResult.purgedFiles >= 1);
    assert.ok(purgeResult.purgedStockItems >= 1);
    assert.equal(await prisma.patientFile.count({ where: { id: patientFile.id } }), 0);
    assert.equal(await prisma.stockItem.count({ where: { id: expiredStock.id } }), 0, "süresi dolan stok kalıcı silinmeli");
    assert.equal(await prisma.stockRecipe.count({ where: { id: expiredRecipe.id } }), 0, "kalıcı stok temizliği bağlı reçeteyi de temizlemeli");
    assert.equal(await prisma.auditLog.count({ where: { organizationId: organization.id, entityId: expiredStock.id, action: "PURGE_STOCK_ITEM" } }), 1, "kalıcı stok temizliği denetim kaydı bırakmalı");
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

    const mobileSession = { kind: "staff" as const, userId: user.id, name: user.name, email: user.email, role: user.role, organizationId: organization.id, branchId: branch.id, credentialVersion: "integration-test" };
    const ownerSnapshotDevice = `owner-snapshot-${suffix}`;
    const ownerSnapshot = await getMobileSnapshot(mobileSession, ownerSnapshotDevice);
    const ownerDoctor = ownerSnapshot.doctors.find((doctor) => doctor.serverId === user.id);
    assert.ok(ownerDoctor && ownerDoctor.readOnly, "klinik sahibi mobil doktor listesinde salt okunur olmalı");
    const mappedOwnerMutation = mobileSyncBatchSchema.parse({ deviceId: ownerSnapshotDevice, operations: [{
      operationId: `mapped-owner-${suffix}`, entityType: "DOCTOR", action: "UPDATE", clientId: String(ownerDoctor.id),
      createdAt: new Date().toISOString(), payload: { name: "Rolü Değişmemeli", email: user.email }
    }] });
    assert.equal((await syncMobileOperations(mobileSession, mappedOwnerMutation))[0].status, "failed", "snapshot eşlemesi klinik sahibini doktora çevirememeli");
    const duplicateOwnerMutation = mobileSyncBatchSchema.parse({ deviceId: `owner-duplicate-${suffix}`, operations: [{
      operationId: `duplicate-owner-${suffix}`, entityType: "DOCTOR", action: "CREATE", clientId: "owner-local",
      createdAt: new Date().toISOString(), payload: { name: "Rolü Yine Değişmemeli", email: user.email }
    }] });
    assert.equal((await syncMobileOperations(mobileSession, duplicateOwnerMutation))[0].status, "failed", "aynı e-postalı klinik sahibi doktor olarak içe aktarılamamalı");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role, Role.CLINIC_OWNER);

    const mobileBatch = mobileSyncBatchSchema.parse({ deviceId: `android-${suffix}`, operations: [
      { operationId: `patient-${suffix}`, entityType: "PATIENT", action: "CREATE", clientId: "local-patient-1", createdAt: new Date().toISOString(), payload: { name: "Yerel Hasta", phone: "+90 555 111 22 33", email: "yerel@example.test", tag: "ACTIVE" } },
      { operationId: `appointment-${suffix}`, entityType: "APPOINTMENT", action: "CREATE", clientId: "local-appointment-1", createdAt: new Date().toISOString(), payload: { patientId: "local-patient-1", date: "2027-02-10", time: "10:30", duration: 30, treatment: "Kontrol", doctor: user.name, room: "Koltuk 1", status: "PLANNED" } },
      { operationId: `payment-${suffix}`, entityType: "PAYMENT", action: "CREATE", clientId: "local-payment-1", createdAt: new Date().toISOString(), payload: { patientId: "local-patient-1", amount: 500, totalAmount: 1500, remainingAmount: 1000, method: "Nakit", description: "Yerel peşinat", isDeposit: true } },
      { operationId: `communication-${suffix}`, entityType: "COMMUNICATION", action: "CREATE", clientId: "local-communication-1", createdAt: new Date().toISOString(), payload: { patientId: "local-patient-1", channel: "IN_APP", direction: "OUTBOUND", message: "Klinik içi teslim edilen not", status: "DELIVERED" } }
    ] });
    assert.equal((await syncMobileOperations(mobileSession, mobileBatch)).filter((item) => item.status === "synced").length, 4);
    assert.equal(await prisma.patient.count({ where: { organizationId: organization.id, phoneNormalized: "5551112233" } }), 1);
    assert.equal(await prisma.appointment.count({ where: { organizationId: organization.id, treatmentType: "Kontrol" } }), 4);
    assert.equal(await prisma.payment.count({ where: { organizationId: organization.id, description: "Yerel peşinat", isDeposit: true } }), 1);
    assert.equal(await prisma.communicationLog.count({ where: { organizationId: organization.id, message: "Klinik içi teslim edilen not", channel: "IN_APP", status: "DELIVERED" } }), 1);
    assert.equal((await syncMobileOperations(mobileSession, mobileBatch)).filter((item) => item.status === "synced").length, 4);
    assert.equal(await prisma.mobileSyncRecord.count({ where: { organizationId: organization.id, deviceId: `android-${suffix}` } }), 4, "aynı mobil paket tekrar gönderildiğinde çift kayıt oluşturmamalı");

    const retiredSurveyBatch = mobileSyncBatchSchema.parse({ deviceId: `retired-${suffix}`, operations: [
      { operationId: `survey-retired-${suffix}`, entityType: "SURVEY", action: "CREATE", clientId: "retired-survey", createdAt: new Date().toISOString(), payload: { title: "Artık kullanılmıyor", active: true } }
    ] });
    assert.equal((await syncMobileOperations(mobileSession, retiredSurveyBatch))[0].status, "failed", "kaldırılan anket modülü doğrudan servis çağrısından da veri yazamamalı");

    const mobileStockDevice = `stock-trash-${suffix}`;
    const mobileStockCreate = mobileSyncBatchSchema.parse({ deviceId: mobileStockDevice, operations: [
      { operationId: `stock-create-${suffix}`, entityType: "STOCK_ITEM", action: "CREATE", clientId: "local-trash-stock", createdAt: new Date().toISOString(), payload: { name: "Mobil Çöp Stoku", category: "Sarf", currentQuantity: 8, minimumQuantity: 2, unit: "adet", supplier: "", purchasePrice: 15 } },
      { operationId: `recipe-create-${suffix}`, entityType: "STOCK_RECIPE", action: "CREATE", clientId: "local-trash-recipe", createdAt: new Date().toISOString(), payload: { treatmentType: "Mobil Arşiv Reçetesi", itemId: "local-trash-stock", quantity: 1 } }
    ] });
    const mobileStockCreated = await syncMobileOperations(mobileSession, mobileStockCreate);
    const mobileStockServerId = mobileStockCreated.find((item) => item.operationId.startsWith("stock-create"))?.serverEntityId;
    assert.ok(mobileStockServerId);
    const mobileRecipeServerId = mobileStockCreated.find((item) => item.operationId.startsWith("recipe-create"))?.serverEntityId;
    assert.ok(mobileRecipeServerId);
    const mobileAssistant = await prisma.user.create({ data: { name: "Mobil Asistan", email: `mobile-assistant-${suffix}@example.test`, passwordHash: "not-used", role: Role.ASSISTANT, organizationId: organization.id, branchId: branch.id } });
    const mobileAssistantSession = { ...mobileSession, userId: mobileAssistant.id, name: mobileAssistant.name, email: mobileAssistant.email, role: Role.ASSISTANT };
    const assistantStockDelete = mobileSyncBatchSchema.parse({ deviceId: mobileStockDevice, operations: [
      { operationId: `stock-delete-assistant-${suffix}`, entityType: "STOCK_ITEM", action: "DELETE", clientId: "local-trash-stock", createdAt: new Date().toISOString(), payload: {} }
    ] });
    assert.equal((await syncMobileOperations(mobileAssistantSession, assistantStockDelete))[0].status, "failed", "assistant mobil eşitlemeden stok silememeli");
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: mobileStockServerId! } })).deletedAt, null);
    const mobileStockDelete = mobileSyncBatchSchema.parse({ deviceId: mobileStockDevice, operations: [
      { operationId: `stock-delete-${suffix}`, entityType: "STOCK_ITEM", action: "DELETE", clientId: "local-trash-stock", createdAt: new Date().toISOString(), payload: {} }
    ] });
    assert.equal((await syncMobileOperations(mobileSession, mobileStockDelete))[0].status, "synced");
    assert.equal(await prisma.auditLog.count({ where: { organizationId: organization.id, entityId: mobileStockServerId, action: "SOFT_DELETE_STOCK_ITEM" } }), 1, "mobil stok silme denetim izi üretmeli");
    assert.equal((await syncMobileOperations(mobileSession, mobileStockDelete))[0].status, "synced");
    assert.equal(await prisma.auditLog.count({ where: { organizationId: organization.id, entityId: mobileStockServerId, action: "SOFT_DELETE_STOCK_ITEM" } }), 1, "mobil silme tekrarı denetim izini çoğaltmamalı");
    assert.ok((await prisma.stockItem.findUniqueOrThrow({ where: { id: mobileStockServerId! } })).deletedAt, "mobil stok silme hard-delete yerine çöp kaydı üretmeli");
    assert.equal(await prisma.stockRecipe.count({ where: { id: mobileRecipeServerId, itemId: mobileStockServerId } }), 1, "mobil stok silme ilişkileri korumalı");
    const deletedSnapshot = await getMobileSnapshot(mobileSession, mobileStockDevice);
    assert.equal(deletedSnapshot.stockItems.some((item) => item.serverId === mobileStockServerId), false, "çöpteki stok mobil snapshot'tan çıkmalı");
    assert.equal(deletedSnapshot.deletedStockItems.some((item) => item.serverId === mobileStockServerId), true, "yönetici mobil snapshot'ında silinen stok çöp kutusuna düşmeli");
    assert.equal(deletedSnapshot.permissions.trash, true, "klinik sahibi mobil stok çöpünü yönetebilmeli");
    const assistantDeletedSnapshot = await getMobileSnapshot(mobileAssistantSession, mobileStockDevice);
    assert.deepEqual(assistantDeletedSnapshot.deletedStockItems, [], "asistan mobil snapshot'ı silinen stok verisini almamalı");
    assert.equal(assistantDeletedSnapshot.permissions.trash, false, "asistan mobil stok çöpünü yönetememeli");
    const mobileStockRestore = mobileSyncBatchSchema.parse({ deviceId: mobileStockDevice, operations: [
      { operationId: `stock-restore-${suffix}`, entityType: "STOCK_ITEM", action: "CREATE", clientId: "local-trash-stock", createdAt: new Date().toISOString(), payload: { name: "Mobil Çöp Stoku", category: "Sarf", currentQuantity: 8, minimumQuantity: 2, unit: "adet", supplier: "", purchasePrice: 15 } }
    ] });
    const assistantStockRestore = mobileSyncBatchSchema.parse({ deviceId: mobileStockDevice, operations: [
      { operationId: `stock-restore-assistant-${suffix}`, entityType: "STOCK_ITEM", action: "CREATE", clientId: "local-trash-stock", createdAt: new Date().toISOString(), payload: { name: "Mobil Çöp Stoku", category: "Sarf", currentQuantity: 8, minimumQuantity: 2, unit: "adet", supplier: "", purchasePrice: 15 } }
    ] });
    assert.equal((await syncMobileOperations(mobileAssistantSession, assistantStockRestore))[0].status, "failed", "assistant mobil eşitlemeden stok geri yükleyememeli");
    assert.ok((await prisma.stockItem.findUniqueOrThrow({ where: { id: mobileStockServerId! } })).deletedAt);
    const restoredMobileStock = (await syncMobileOperations(mobileSession, mobileStockRestore))[0];
    assert.equal(restoredMobileStock.status, "synced");
    assert.equal(restoredMobileStock.serverEntityId, mobileStockServerId, "mobil çöp geri yükleme aynı sunucu kaydını canlandırmalı");
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: mobileStockServerId! } })).deletedAt, null);
    assert.equal(await prisma.auditLog.count({ where: { organizationId: organization.id, entityId: mobileStockServerId, action: "RESTORE_STOCK_ITEM" } }), 1, "mobil stok geri yükleme denetim izi üretmeli");
    assert.equal((await syncMobileOperations(mobileSession, mobileStockRestore))[0].status, "synced");
    assert.equal(await prisma.auditLog.count({ where: { organizationId: organization.id, entityId: mobileStockServerId, action: "RESTORE_STOCK_ITEM" } }), 1, "mobil geri yükleme tekrarı denetim izini çoğaltmamalı");

    const dashboardBeforePayments = await getDashboardMetrics(organization.id, { branchId: branch.id, role: Role.CLINIC_OWNER });
    const futurePaidAt = new Date();
    futurePaidAt.setUTCMonth(futurePaidAt.getUTCMonth() + 2, 1);
    futurePaidAt.setUTCHours(12, 0, 0, 0);
    await prisma.payment.createMany({ data: [
      { patientId: patient.id, type: "INCOME", amount: 111, method: "CARD", status: "PAID", paidAt: new Date(), organizationId: organization.id, branchId: branch.id },
      { patientId: patient.id, type: "INCOME", amount: 999, method: "CARD", status: "PAID", paidAt: futurePaidAt, organizationId: organization.id, branchId: branch.id }
    ] });
    const dashboardAfterPayments = await getDashboardMetrics(organization.id, { branchId: branch.id, role: Role.CLINIC_OWNER });
    assert.equal(dashboardAfterPayments.monthlyRevenue - dashboardBeforePayments.monthlyRevenue, 111, "aylık tahsilat gelecek aya tarihli ödemeyi içermemeli");
    await prisma.payment.create({ data: { patientId: organizationSecondPatient.id, type: "INCOME", amount: 777, method: "CARD", status: "PENDING", dueDate: new Date(), organizationId: organization.id, branchId: organizationSecondBranch.id } });
    const branchDashboard = await getDashboardMetrics(organization.id, { branchId: branch.id, role: Role.CLINIC_OWNER });
    const organizationDashboard = await getDashboardMetrics(organization.id, { role: Role.CLINIC_OWNER });
    assert.equal(organizationDashboard.pendingAmount - branchDashboard.pendingAmount, 777, "pano finans özeti başka şubenin bekleyen ödemesini göstermemeli");
    const receptionistDashboard = await getDashboardMetrics(organization.id, { branchId: branch.id, role: Role.RECEPTIONIST });
    assert.equal(receptionistDashboard.pendingAmount, 0, "finans yetkisi olmayan rol pano tutarlarını almamalı");
    assert.deepEqual(receptionistDashboard.revenueByMonth, []);
    const accountantDashboard = await getDashboardMetrics(organization.id, { branchId: branch.id, role: Role.ACCOUNTANT });
    assert.deepEqual(accountantDashboard.todayAppointments, [], "randevu yetkisi olmayan rol pano hasta akışını almamalı");
    assert.deepEqual(accountantDashboard.appointmentDensity, []);

    await prisma.payment.create({ data: { patientId: patient.id, type: "INCOME", amount: 250, method: "CARD", status: "PENDING", dueDate: new Date("2027-01-10T09:00:00.000Z"), organizationId: organization.id, branchId: branch.id } });
    const dailyNow = new Date("2027-01-10T09:30:00.000Z");
    const dailyTasks = await getDailyClinicTasks(organization.id, branch.id, Role.CLINIC_OWNER, dailyNow);
    assert.ok(dailyTasks.some((task) => task.href === "/dashboard/appointments"), "günlük randevu görevi üretilmeli");
    assert.ok(dailyTasks.some((task) => task.href === "/dashboard/finance"), "bekleyen ödeme görevi üretilmeli");
    assert.ok(dailyTasks.some((task) => task.href === "/dashboard/stocks"), "düşük stok görevi üretilmeli");
    assert.ok(dailyTasks.some((task) => task.href === "/dashboard/treatments"), "yarım tedavi görevi üretilmeli");
    const secondDailyRead = await getDailyClinicTasks(organization.id, branch.id, Role.CLINIC_OWNER, dailyNow);
    assert.equal(new Set(secondDailyRead.map((task) => task.sourceKey)).size, secondDailyRead.length, "günlük görev üretimi tekrar çağrıda çoğalmamalı");
    const completedTask = secondDailyRead.find((task) => task.href === "/dashboard/stocks")!;
    assert.ok(completedTask);
    const receptionistTasks = await getDailyClinicTasks(organization.id, branch.id, Role.RECEPTIONIST, dailyNow);
    assert.ok(receptionistTasks.every((task) => task.href === "/dashboard/appointments"), "resepsiyon finans, stok ve tedavi görev ayrıntılarını görmemeli");
    await assert.rejects(() => completeDailyClinicTask(organization.id, completedTask.id, branch.id, Role.RECEPTIONIST, dailyNow), /yetkiniz yok/);
    await assert.rejects(() => completeDailyClinicTask(organization.id, completedTask.id, organizationSecondBranch.id, Role.CLINIC_OWNER, dailyNow), /bulunamadı|yetkiniz yok/);
    await completeDailyClinicTask(organization.id, completedTask.id, branch.id, Role.CLINIC_OWNER, dailyNow);
    assert.equal((await getDailyClinicTasks(organization.id, branch.id, Role.CLINIC_OWNER, dailyNow)).some((task) => task.id === completedTask.id), false, "yapıldı görevi listeden kaybolmalı");
    const nextDayTasks = await getDailyClinicTasks(organization.id, branch.id, Role.CLINIC_OWNER, new Date("2027-01-11T09:30:00.000Z"));
    const nextDayStockTask = nextDayTasks.find((task) => task.href === "/dashboard/stocks");
    assert.ok(nextDayStockTask && nextDayStockTask.id !== completedTask.id, "devam eden bulgu ertesi gün yeni günlük görev üretmeli");

    const concurrentMobileBatch = (device: string) => mobileSyncBatchSchema.parse({ deviceId: `${device}-${suffix}`, operations: [
      { operationId: `${device}-patient-${suffix}`, entityType: "PATIENT", action: "CREATE", clientId: "race-patient", createdAt: new Date().toISOString(), payload: { name: `Mobil Yarış ${device}`, phone: `+90 555 222 33 ${device === "a" ? "01" : "02"}`, tag: "ACTIVE" } },
      { operationId: `${device}-appointment-${suffix}`, entityType: "APPOINTMENT", action: "CREATE", clientId: "race-appointment", createdAt: new Date().toISOString(), payload: { patientId: "race-patient", date: "2027-03-10", time: "10:30", duration: 30, treatment: "Mobil yarış", doctor: user.name, room: "Mobil Koltuk", status: "PLANNED" } }
    ] });
    const concurrentSync = await Promise.all([
      syncMobileOperations(mobileSession, concurrentMobileBatch("a")),
      syncMobileOperations(mobileSession, concurrentMobileBatch("b"))
    ]);
    assert.equal(concurrentSync.flat().filter((item) => item.operationId.includes("appointment") && item.status === "synced").length, 1, "iki cihaz aynı randevu slotuna eşzamanlı yazamamalı");
    assert.equal(await prisma.appointment.count({ where: { organizationId: organization.id, startsAt: new Date("2027-03-10T07:30:00.000Z") } }), 1);

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
