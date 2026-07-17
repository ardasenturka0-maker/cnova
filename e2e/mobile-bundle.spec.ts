import { expect, test } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";

const mobileUrl = pathToFileURL(path.resolve("mobile/assets/index.html")).href;
const iphoneDemoUrl = pathToFileURL(path.resolve("releases/ClinicNova-iPhone-Demo.html")).href;

test("single-file iPhone demo opens without network or extra files", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("file:")) requests.push(request.url());
  });
  await page.goto(iphoneDemoUrl);
  await expect(page.getByRole("heading", { name: /Günaydın/ })).toBeVisible();
  await expect(page.locator("#loginScreen")).toBeHidden();
  await page.locator(".bottom-nav").getByRole("button", { name: "Stok", exact: true }).click();
  await expect(page.getByText("Anestezi kartuşu", { exact: true })).toBeVisible();
  expect(requests).toEqual([]);
});

test("iPhone file preview never exposes the login gate when scripts are blocked", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(iphoneDemoUrl);
  await expect(page.locator("#loginScreen")).toBeHidden();
  await expect(page.locator("#appShell")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Günaydın/ })).toBeVisible();
  await context.close();
});

test("a failed mobile update keeps one local record instead of adding its server twin", async ({ page }) => {
  await page.addInitScript(() => {
    const values = new Map<string, string>();
    values.set("clinicnova.localDataMigrated", JSON.stringify(true));
    values.set("clinicnova.deviceId", JSON.stringify("android-regression-device"));
    values.set("clinicnova.patients", JSON.stringify([{ id: 123, name: "Yerel Düzenleme", phone: "+90 555 000 00 00", email: "", tag: "ACTIVE", color: 0 }]));
    values.set("clinicnova.syncMap", JSON.stringify({ "PATIENT:123": "server-patient-1" }));
    values.set("clinicnova.syncQueue", JSON.stringify([{ operationId: "operation-failed-update", entityType: "PATIENT", action: "UPDATE", clientId: "123", createdAt: new Date().toISOString(), payload: { name: "Yerel Düzenleme", phone: "+90 555 000 00 00" } }]));
    Object.assign(window, {
      CLINICNOVA_MOBILE_CONFIG: { mode: "production", serverUrl: "" },
      __clinicNovaNativeValues: values,
      ClinicNovaNative: { storage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } }
    });
  });
  await page.goto(mobileUrl);
  await page.evaluate(() => {
    const callback = (window as typeof window & { ClinicNovaSyncResult: (status: number, body: string) => void }).ClinicNovaSyncResult;
    callback(200, JSON.stringify({
      results: [{ operationId: "operation-failed-update", status: "failed", error: "Geçici çakışma" }], synced: 0, failed: 1,
      snapshot: { permissions: { patients: true }, patients: [{ id: 999, serverId: "server-patient-1", name: "Sunucu Kopyası", phone: "+90 555 000 00 00", email: "", tag: "ACTIVE", color: 1 }], appointments: [], transactions: [], treatmentPlans: [], stockItems: [], stockRecipes: [], doctors: [], treatments: [], staff: [], consents: [], surveys: [], surveyResponses: [], communication: [], recalls: [], leads: [], clinicConfig: { clinicName: "Test Klinik", chairs: [] } }
    }));
  });
  const storedPatients = await page.evaluate(() => {
    const values = (window as typeof window & { __clinicNovaNativeValues: Map<string, string> }).__clinicNovaNativeValues;
    return JSON.parse(values.get("clinicnova.patients") || "[]");
  });
  expect(storedPatients).toHaveLength(1);
  expect(storedPatients[0].name).toBe("Yerel Düzenleme");
});

test("a clinic can create an encrypted serverless device mesh", async ({ page }) => {
  await page.addInitScript(() => {
    const values = new Map<string, string>();
    const native = {
      storage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); return true; }, removeItem: (key: string) => { values.delete(key); return true; } },
      meshGetConfig: () => values.get("native.meshConfig") || "",
      meshConfigure: (json: string) => { values.set("native.meshConfig", json); return true; },
      meshPublish: (json: string) => { values.set("native.meshEnvelope", json); return true; },
      meshSyncNow: () => values.set("native.meshSyncNow", "true"),
      meshDisable: () => true,
      onMeshEnvelope: () => undefined,
      onMeshStatus: () => undefined
    };
    Object.assign(window, { CLINICNOVA_MOBILE_CONFIG: { mode: "production", serverUrl: "", platformLabel: "Android" }, ClinicNovaNative: native, __clinicNovaNativeValues: values });
  });
  await page.goto(mobileUrl);
  await page.locator('#localClinicName').fill("Mesh Test Kliniği");
  await page.locator('#localAdminName').fill("Test Yönetici");
  await page.locator('#loginEmail').fill("mesh@example.test");
  await page.locator('#loginPassword').fill("Guvenli-Test-1234");
  await page.getByRole("button", { name: "Hesabı oluştur ve başla" }).click();
  await expect(page.getByRole("heading", { name: /Günaydın/ })).toBeVisible();
  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.getByRole("button", { name: "Diğer", exact: true }).click();
  await page.getByRole("button", { name: /Klinik yönetimi/ }).click();
  await page.getByRole("button", { name: /Cihaz eşitleme/ }).click();
  await page.getByRole("button", { name: "Bu cihazda klinik ağı oluştur" }).click();
  await expect(page.locator('#meshPairingCode')).toHaveValue(/^CN1\./);
  const nativeState = await page.evaluate(() => {
    const values = (window as typeof window & { __clinicNovaNativeValues: Map<string, string> }).__clinicNovaNativeValues;
    return { config: JSON.parse(values.get("native.meshConfig") || "null"), envelope: JSON.parse(values.get("native.meshEnvelope") || "null") };
  });
  expect(nativeState.config.clinicId).toMatch(/^clinic_/);
  expect(atob(nativeState.config.secret)).toHaveLength(32);
  expect(nativeState.envelope.operations.length).toBeGreaterThan(0);
});

test("bundled Android interface works offline", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.addInitScript(() => {
    (window as typeof window & { CLINICNOVA_MOBILE_CONFIG?: { mode: string; serverUrl: string } }).CLINICNOVA_MOBILE_CONFIG = { mode: "demo", serverUrl: "" };
  });
  await page.goto(mobileUrl);
  await expect(page.getByRole("heading", { name: "Kliniğiniz cebinizde." })).toBeVisible();
  await page.getByRole("button", { name: "Demo girişi" }).click();
  await expect(page.getByRole("heading", { name: /Günaydın/ })).toBeVisible();

  await page.getByRole("button", { name: /Gelir fırsatları hazır/ }).click();
  await expect(page.getByRole("heading", { name: "Bugünkü fırsatlar" })).toBeVisible();
  await expect(page.getByText("John Smith", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Geciken tahsilatları aç" }).click();
  await expect(page.getByRole("heading", { name: "Tahsilat merkezi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gecikenler" })).toBeVisible();
  await expect(page.locator("#transactionList").getByText("Can Şahin", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Hastalar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hastalar" })).toBeVisible();
  await page.getByRole("button", { name: "Hasta ekle" }).click();
  const patientForm = page.locator("#patientForm");
  await patientForm.locator('input[name="name"]').fill("Tuna Akın");
  await patientForm.locator('input[name="phone"]').fill("+90 555 000 00 00");
  await expect(patientForm.locator('input[name="name"]')).toHaveValue("Tuna Akın");
  await expect(patientForm.locator('input[name="phone"]')).toHaveValue("+90 555 000 00 00");
  await page.getByRole("button", { name: "Hastayı kaydet" }).click();
  await expect(page.locator("#patientList").getByText("Tuna Akın", { exact: true })).toBeVisible();

  await page.locator("#patientList button.patient-card").filter({ hasText: "Tuna Akın" }).click();
  await expect(page.getByText("Geçmiş tedaviler", { exact: true })).toBeVisible();
  await expect(page.getByText("Ödeme geçmişi", { exact: true })).toBeVisible();
  await expect(page.getByText("Before / After fotoğrafları", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Geçmiş tedavi ekle" }).click();
  await page.locator('#treatmentHistoryForm input[name="treatment"]').fill("Acil muayene");
  await page.locator('#treatmentHistoryForm textarea[name="note"]').fill("Randevu dışı hassasiyet kontrolü yapıldı.");
  await page.getByRole("button", { name: "Tedavi kaydını ekle" }).click();
  await expect(page.getByText("Acil muayene", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Acil muayene kaydını sil" }).click();
  await expect(page.getByText("Acil muayene", { exact: true })).toHaveCount(0);
  await page.locator('input[data-media-kind="Before"]').setInputFiles({
    name: "before.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")
  });
  await expect(page.getByText(/Before · Şimdi/)).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Before fotoğrafını sil" }).click();
  await expect(page.getByText(/Before · Şimdi/)).toHaveCount(0);
  await page.getByRole("button", { name: "Yeni randevu oluştur" }).click();
  await expect(page.getByRole("combobox", { name: "Hasta", exact: true }).locator("option:checked")).toHaveText("Tuna Akın");
  await page.getByRole("button", { name: "Randevuyu kaydet" }).click();
  await expect(page.locator("#appointmentList").getByText("Tuna Akın", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Tuna Akın randevusunu sil" }).click();
  await expect(page.locator("#appointmentList").getByText("Tuna Akın", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Ana Sayfa", exact: true }).click();
  await page.getByRole("button", { name: "Ödeme al" }).click();
  await page.getByRole("combobox", { name: "Hasta", exact: true }).selectOption({ label: "Tuna Akın" });
  await page.getByLabel("İşlem 1").fill("İmplant");
  await page.getByLabel("Bedeli").first().fill("30000");
  await page.getByLabel("İşlem 2").fill("Kemik grefti");
  await page.getByLabel("Bedeli").nth(1).fill("5000");
  await page.getByLabel("Şimdi alınan").fill("1250");
  await page.getByLabel("Bu tahsilat peşinattır").check();
  await page.getByRole("button", { name: "Ödemeyi kaydet" }).click();
  await expect(page.getByRole("heading", { name: "Tahsilat merkezi" })).toBeVisible();
  await expect(page.locator("#transactionList").getByText("Tuna Akın", { exact: true })).toBeVisible();
  await expect(page.locator("#transactionList")).toContainText("İmplant");
  await expect(page.locator("#transactionList")).toContainText("Kemik grefti");
  await expect(page.locator("#transactionList")).toContainText("Kalan");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Tuna Akın finans kaydını sil" }).click();
  await expect(page.locator("#transactionList").getByText("Tuna Akın", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Hastalar", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Tuna Akın hastasını sil" }).click();
  await expect(page.locator("#patientList").getByText("Tuna Akın", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Ana Sayfa", exact: true }).click();
  await page.getByRole("button", { name: "Bildirimler" }).click();
  await page.getByRole("button", { name: /Yeni sağlık turizmi lead/ }).click();
  await expect(page.getByRole("heading", { name: "Bugünkü fırsatlar" })).toBeVisible();

  await page.getByRole("button", { name: "Kapat", exact: true }).click();

  await page.getByRole("button", { name: "Diğer", exact: true }).click();
  await page.locator("#moduleGrid").getByRole("button", { name: /Sağlık turizmi/ }).click();
  await page.getByRole("button", { name: "Yeni lead ekle" }).click();
  await page.locator('#leadForm input[name="name"]').fill("Anna Müller");
  await page.locator('#leadForm input[name="country"]').fill("Almanya");
  await page.locator('#leadForm input[name="phone"]').fill("+49 555 1234567");
  await page.locator('#leadForm input[name="treatment"]').fill("İmplant");
  await page.locator('#leadForm input[name="score"]').fill("91");
  await page.getByRole("button", { name: "Lead’i kaydet" }).click();
  await expect(page.getByText("Anna Müller", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Anna Müller lead kaydını sil" }).click();
  await expect(page.getByText("Anna Müller", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Kapat", exact: true }).click();

  await page.getByRole("button", { name: "Diğer", exact: true }).click();
  await page.locator("#moduleGrid").getByRole("button", { name: /İletişim/ }).click();
  await page.getByRole("button", { name: "İletişim kaydı ekle" }).click();
  await page.locator('#communicationForm input[name="patient"]').fill("Tuna Akın");
  await page.locator('#communicationForm select[name="channel"]').selectOption({ label: "Telefon" });
  await page.locator('#communicationForm select[name="status"]').selectOption({ label: "Arandı" });
  await page.locator('#communicationForm textarea[name="message"]').fill("Kontrol randevusu için arandı.");
  await page.getByRole("button", { name: "Kaydı ekle" }).click();
  await expect(page.getByText("Kontrol randevusu için arandı.", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Tuna Akın iletişim kaydını sil" }).click();
  await expect(page.getByText("Kontrol randevusu için arandı.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Kapat", exact: true }).click();

  await page.locator(".bottom-nav").getByRole("button", { name: "Tedaviler", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tedavi planları" })).toBeVisible();
  await page.getByRole("button", { name: "Tedavi planı ekle", exact: true }).click();
  await page.locator('#treatmentPlanForm select[name="patientId"]').selectOption({ label: "Ayşe Yılmaz" });
  await page.locator('#treatmentPlanForm input[name="treatment"]').fill("Zirkonyum kaplama");
  await page.locator('#treatmentPlanForm input[name="tooth"]').fill("11-21");
  await page.locator('#treatmentPlanForm input[name="total"]').fill("24000");
  await page.locator('#treatmentPlanForm input[name="paid"]').fill("4000");
  await page.locator('#treatmentPlanForm select[name="installmentCount"]').selectOption("4");
  await page.locator('#treatmentPlanForm input[name="firstInstallmentDate"]').fill("2026-08-15");
  await page.locator('#treatmentPlanForm input[name="paymentPlanNote"]').fill("Her ayın 15'inde");
  await page.locator('#treatmentPlanForm textarea[name="note"]').fill("Dijital ölçü sonrası renk provası yapılacak.");
  await page.getByRole("button", { name: "Tedavi planını kaydet" }).click();
  const newPlan = page.locator("#treatmentPlanList").getByRole("button", { name: /Zirkonyum kaplama/ });
  await expect(newPlan).toBeVisible();
  await newPlan.click();
  await expect(page.getByText("11-21", { exact: true })).toBeVisible();
  await expect(page.locator("#modalBody")).toContainText("Dijital ölçü sonrası renk provası yapılacak.");
  await expect(page.locator("#modalBody")).toContainText("4 taksit");
  await expect(page.locator("#modalBody")).toContainText("Her ayın 15'inde");
  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.locator("#treatmentPlanList").getByRole("button", { name: /Ayşe Yılmaz/ }).filter({ hasText: "İmplant" }).click();
  await expect(page.getByRole("heading", { name: "Ayşe Yılmaz" })).toBeVisible();
  await expect(page.getByText("Diş / bölge", { exact: true })).toBeVisible();
  await expect(page.getByText("Dr. Emir Aydın", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Kapat", exact: true }).click();

  await page.locator(".bottom-nav").getByRole("button", { name: "Stok", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Stok", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Stok ürünü ekle" }).click();
  await page.locator('#stockItemForm input[name="name"]').fill("Maske");
  await page.locator('#stockItemForm input[name="category"]').fill("Sarf");
  await page.locator('#stockItemForm input[name="amount"]').fill("10");
  await page.locator('#stockItemForm input[name="minimum"]').fill("5");
  await page.getByRole("button", { name: "Ürünü kaydet" }).click();
  await expect(page.locator("#stockList").getByText("Maske", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Adet ekle / çıkar" }).click();
  await page.locator('#stockMovementForm select[name="itemId"]').selectOption({ label: "Maske · 10 adet" });
  await page.locator('#stockMovementForm select[name="type"]').selectOption("OUT");
  await page.locator('#stockMovementForm input[name="quantity"]').fill("3");
  await page.getByRole("button", { name: "Hareketi kaydet" }).click();
  await expect(page.locator("#stockList").getByRole("button", { name: /Maske/ })).toContainText("7");
  await page.getByRole("button", { name: "Tedavi reçetesi tanımla" }).click();
  await page.locator('#stockRecipeForm input[name="treatmentType"]').fill("Kontrol");
  await page.locator('#stockRecipeForm select[name="itemId"]').selectOption({ label: "Maske · 7 adet" });
  await page.locator('#stockRecipeForm input[name="quantity"]').fill("2");
  await page.getByRole("button", { name: "Reçeteyi kaydet" }).click();
  await expect(page.locator("#stockRecipeList")).toContainText("Kontrol");
  await page.locator("#stockList").getByRole("button", { name: /Maske/ }).click();
  await expect(page.getByRole("button", { name: "Satın alma sayfası ekle" })).toBeVisible();
  await page.getByRole("button", { name: "Kapat", exact: true }).click();

  await page.locator(".bottom-nav").getByRole("button", { name: "Randevu", exact: true }).click();
  await expect(page.locator("#dateStrip .date-button")).toHaveCount(42);
  await page.locator("#appointmentList .appointment-card").filter({ hasText: "Zeynep Çelik" }).click();
  await page.getByLabel("Durum").selectOption("COMPLETED");
  await page.getByRole("button", { name: "Durumu güncelle" }).click();
  await page.locator(".bottom-nav").getByRole("button", { name: "Stok", exact: true }).click();
  await expect(page.locator("#stockList").getByRole("button", { name: /Maske/ })).toContainText("5");
  await page.locator(".bottom-nav").getByRole("button", { name: "Hastalar", exact: true }).click();
  await page.locator("#patientList button.patient-card").filter({ hasText: "Zeynep Çelik" }).click();
  await expect(page.locator("#modalBody")).toContainText("Kontrol");
  await expect(page.locator("#modalBody")).toContainText("Malzeme reçetesi stoktan işlendi");
  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.locator(".bottom-nav").getByRole("button", { name: "Randevu", exact: true }).click();
  await page.locator("#appointmentList .appointment-card").filter({ hasText: "Zeynep Çelik" }).click();
  await page.getByLabel("Durum").selectOption("PLANNED");
  await page.getByRole("button", { name: "Durumu güncelle" }).click();
  await page.locator(".bottom-nav").getByRole("button", { name: "Stok", exact: true }).click();
  await expect(page.locator("#stockList").getByRole("button", { name: /Maske/ })).toContainText("7");
  await page.locator(".bottom-nav").getByRole("button", { name: "Hastalar", exact: true }).click();
  await page.locator("#patientList button.patient-card").filter({ hasText: "Zeynep Çelik" }).click();
  await expect(page.locator("#modalBody")).not.toContainText("Malzeme reçetesi stoktan işlendi");
  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.locator(".bottom-nav").getByRole("button", { name: "Randevu", exact: true }).click();
  await page.getByRole("button", { name: "Sonraki ay" }).click();
  await expect(page.locator("#calendarMonthLabel")).not.toBeEmpty();

  await page.getByRole("button", { name: "Diğer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Diğer", exact: true })).toHaveAttribute("aria-current", "page");
  const moduleCases: Array<[string, string, string | null]> = [
    ["Sağlık turizmi", "John Smith", "John Smith lead kaydını sil"],
    ["İletişim", "Demo taslak", "Emily Carter iletişim kaydını sil"],
    ["Raporlar", "Net akış", null]
  ];
  for (const [module, expected, deleteName] of moduleCases) {
    await page.getByRole("button", { name: new RegExp(`^${module}`) }).click();
    await expect(page.getByRole("heading", { name: module })).toBeVisible();
    await expect(page.locator("#modalBody").getByText(expected, { exact: true }).first()).toBeVisible();
    if (deleteName) {
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: deleteName }).click();
      await expect(page.locator("#modalBody").getByText(expected, { exact: true })).toHaveCount(0);
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: new RegExp(`^${module}`) })).toBeFocused();
  }

  await page.getByRole("button", { name: /^Klinik yönetimi/ }).click();
  await page.getByRole("button", { name: "Doktor ekle" }).click();
  await page.locator('#doctorForm input[name="name"]').fill("Dr. Deniz Test");
  await page.locator('#doctorForm input[name="email"]').fill("deniz@clinicnova.test");
  await page.locator('#doctorForm input[name="specialty"]').fill("Pedodonti");
  await page.getByRole("button", { name: "Doktoru kaydet" }).click();
  await expect(page.getByText("Dr. Deniz Test", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Koltuk ekle" }).click();
  await page.locator('#chairForm input[name="name"]').fill("Koltuk 4");
  await page.getByRole("button", { name: "Koltuğu kaydet" }).click();
  await expect(page.getByText("Koltuk 4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Klinik adını değiştir" }).click();
  await page.locator('#clinicNameForm input[name="name"]').fill("ClinicNova Test Kliniği");
  await page.getByRole("button", { name: "Adı güncelle" }).click();
  await expect(page.locator("#modalBody").getByText("ClinicNova Test Kliniği", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#branchLabel")).toHaveText("ClinicNova Test Kliniği");

  await page.getByRole("button", { name: /^Çöp Kutusu/ }).click();
  await expect(page.getByRole("heading", { name: "Çöp Kutusu" })).toBeVisible();
  await expect(page.getByText("30 gün kaldı").first()).toBeVisible();
  const trashedLead = page.locator(".trash-record").filter({ hasText: "John Smith" });
  await trashedLead.getByRole("button", { name: "Geri yükle" }).click();
  await expect(page.locator(".trash-record").filter({ hasText: "John Smith" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Sağlık turizmi/ }).click();
  await expect(page.getByText("John Smith", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  expect(errors).toEqual([]);
});

test("production Android starts with an empty persistent local workspace", async ({ page }) => {
  await page.goto(mobileUrl);
  await expect(page.getByRole("heading", { name: "Yerel yönetici hesabını oluşturun." })).toBeVisible();
  await page.getByLabel("Klinik adı").fill("Nova Diş Kliniği");
  await page.getByLabel("Yönetici adı").fill("Tuna Akın");
  await page.getByLabel("E-posta").fill("tuna@nova.test");
  await page.getByLabel("Parola").fill("GuvenliYerelParola!2026");
  await page.getByRole("button", { name: "Hesabı oluştur ve başla" }).click();
  await expect(page.getByRole("heading", { name: /Günaydın, Tuna/ })).toBeVisible();
  const recoveryCode = (await page.locator("#modalBody strong").textContent())!.trim();
  await page.getByRole("button", { name: "Anladım, kaydettim" }).click();
  await page.getByRole("button", { name: "Hastalar", exact: true }).click();
  await expect(page.locator("#patientList")).toContainText("Sonuç bulunamadı");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Nova Diş Kliniği hesabına giriş" })).toBeVisible();
  await page.getByLabel("Parola").fill("yanlis-parola");
  await page.getByRole("button", { name: "Çevrimdışı giriş yap" }).click();
  await expect(page.getByRole("status")).toContainText("E-posta veya parola yanlış");
  await page.getByLabel("Parola").fill("GuvenliYerelParola!2026");
  await page.getByRole("button", { name: "Çevrimdışı giriş yap" }).click();
  await expect(page.getByRole("heading", { name: /Günaydın, Tuna/ })).toBeVisible();
  const account = await page.evaluate(() => JSON.parse(localStorage.getItem("clinicnova.localAccount") || "{}"));
  expect(account).not.toHaveProperty("password");
  expect(account.passwordHash).toMatch(/^[A-Za-z0-9+/]+=*$/);

  await page.getByRole("button", { name: "Diğer", exact: true }).click();
  await page.getByRole("button", { name: /Çıkış yap/ }).click();
  await page.getByRole("button", { name: "Parolamı kurtarma koduyla sıfırla" }).click();
  await page.getByLabel("Kurtarma kodu").fill(recoveryCode);
  await page.getByLabel("Yeni parola").fill("YeniGuvenliParola!2026");
  await page.getByRole("button", { name: "Parolayı yenile" }).click();
  await expect(page.getByRole("heading", { name: "Parola yenilendi" })).toBeVisible();
  await page.getByRole("button", { name: "Kaydettim" }).click();
  await page.getByLabel("Parola", { exact: true }).fill("YeniGuvenliParola!2026");
  await page.getByRole("button", { name: "Çevrimdışı giriş yap" }).click();
  await page.getByRole("button", { name: "Ana Sayfa", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Günaydın, Tuna/ })).toBeVisible();
});

test("production Android can be reviewed without a password and keeps sample data isolated", async ({ page }) => {
  await page.goto(mobileUrl);
  await expect(page.getByRole("button", { name: "Sürümü incele" })).toBeVisible();
  await page.getByRole("button", { name: "Sürümü incele" }).click();
  await expect(page.getByRole("heading", { name: "Sürüm incelemeye hazır 👋" })).toBeVisible();
  await expect(page.getByText("İnceleme modu", { exact: true })).toBeVisible();
  await page.locator(".bottom-nav").getByRole("button", { name: "Finans", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tahsilat merkezi" })).toBeVisible();
  await expect(page.getByText("Kesilen toplam", { exact: true })).toBeVisible();
  await expect(page.getByText("Toplam gider", { exact: true })).toBeVisible();
  await expect(page.locator("#pendingPaymentList").getByText("Ayşe Yılmaz", { exact: true })).toBeVisible();
  await page.locator("#pendingPaymentList").getByRole("button").filter({ hasText: "Ayşe Yılmaz" }).click();
  await page.getByRole("button", { name: "Bu plana tahsilat işle" }).click();
  await page.locator('#balancePaymentForm input[name="amount"]').fill("1000");
  await page.getByRole("button", { name: "Tahsilatı kaydet" }).click();
  await expect(page.locator("#modalBody")).toContainText("Tahsilat geçmişi");
  await expect(page.locator("#modalBody")).toContainText("₺1.000");
  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.getByRole("button", { name: "Gider ekle" }).click();
  await page.locator('#expenseForm input[name="name"]').fill("Test Laboratuvarı");
  await page.locator('#expenseForm select[name="category"]').selectOption("Laboratuvar");
  await page.locator('#expenseForm input[name="amount"]').fill("1250");
  await page.getByRole("button", { name: "Gideri kaydet" }).click();
  await expect(page.locator("#transactionList").getByText("Test Laboratuvarı", { exact: true })).toBeVisible();
  await page.locator(".bottom-nav").getByRole("button", { name: "Onam", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Onam merkezi" })).toBeVisible();
  await expect(page.getByText("Hasta belgeleri", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yeni onam oluştur" }).click();
  await page.locator('#consentForm select[name="patientId"]').selectOption({ label: "Ayşe Yılmaz" });
  await page.locator('#consentForm select[name="form"]').selectOption("Cerrahi işlem onamı");
  await page.locator('#consentForm select[name="status"]').selectOption("İmza bekliyor");
  await page.getByRole("button", { name: "Onamı kaydet" }).click();
  const consent = page.locator("#consentList").getByRole("button", { name: /Cerrahi işlem onamı/ });
  await expect(consent).toBeVisible();
  await consent.click();
  await expect(page.getByRole("heading", { name: "Ayşe Yılmaz" })).toBeVisible();
  await page.getByRole("button", { name: "Durumu değiştir" }).click();
  await page.locator('#consentStatusForm select[name="status"]').selectOption("İmzalandı");
  await page.locator('#consentStatusForm input[name="actor"]').fill("Ayşe Yılmaz");
  await page.locator('#consentStatusForm textarea[name="note"]').fill("Klinikte tedavi öncesi imzalandı.");
  await page.getByRole("button", { name: "Durumu kaydet" }).click();
  await expect(page.locator("#modalBody")).toContainText("İmzalandı");
  await expect(page.locator("#modalBody")).toContainText("Durum geçmişi");
  await page.getByRole("button", { name: "Durumu değiştir" }).click();
  await expect(page.locator('#consentStatusForm select[name="status"] option')).toHaveCount(2);
  await page.locator('#consentStatusForm select[name="status"]').selectOption("İptal edildi");
  await page.locator('#consentStatusForm textarea[name="note"]').fill("Hasta tedavi planını değiştirdi; yeni sürüm hazırlanacak.");
  await page.getByRole("button", { name: "Durumu kaydet" }).click();
  await expect(page.locator("#modalBody")).toContainText("İptal edildi");
  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.getByRole("button", { name: "Hastalar", exact: true }).click();
  await expect(page.locator("#patientList").getByText("Ayşe Yılmaz", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hasta ekle" }).click();
  await page.locator('#patientForm input[name="name"]').fill("İnceleme Hastası");
  await page.locator('#patientForm input[name="phone"]').fill("+90 555 000 11 22");
  await page.getByRole("button", { name: "Hastayı kaydet" }).click();
  await expect(page.locator("#patientList").getByText("İnceleme Hastası", { exact: true })).toBeVisible();
  await page.locator(".bottom-nav").getByRole("button", { name: "Onam", exact: true }).click();
  await page.getByRole("button", { name: "Yeni onam oluştur" }).click();
  await page.locator('#consentForm select[name="patientId"]').selectOption({ label: "İnceleme Hastası" });
  await page.locator('#consentForm select[name="form"]').selectOption("Genel tedavi onamı");
  await page.getByRole("button", { name: "Onamı kaydet" }).click();
  await expect(page.locator("#consentList").getByText("İnceleme Hastası", { exact: true })).toBeVisible();
  await page.locator(".bottom-nav").getByRole("button", { name: "Hastalar", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "İnceleme Hastası hastasını sil" }).click();
  await page.locator(".bottom-nav").getByRole("button", { name: "Onam", exact: true }).click();
  await expect(page.locator("#consentList").getByText("İnceleme Hastası", { exact: true })).toHaveCount(0);
  await page.locator(".bottom-nav").getByRole("button", { name: "Diğer", exact: true }).click();
  await page.getByRole("button", { name: /^Çöp Kutusu/ }).click();
  await page.locator(".trash-record").filter({ hasText: "İnceleme Hastası" }).getByRole("button", { name: "Geri yükle" }).click();
  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.locator(".bottom-nav").getByRole("button", { name: "Onam", exact: true }).click();
  await expect(page.locator("#consentList").getByText("İnceleme Hastası", { exact: true })).toBeVisible();
  const persisted = await page.evaluate(() => ({
    account: localStorage.getItem("clinicnova.localAccount"),
    patients: JSON.parse(localStorage.getItem("clinicnova.patients") || "[]") as Array<{ name?: string }>,
    queue: JSON.parse(localStorage.getItem("clinicnova.syncQueue") || "[]") as unknown[]
  }));
  expect(persisted.account).toBeNull();
  expect(persisted.patients.some((patient) => patient.name === "İnceleme Hastası")).toBe(false);
  expect(persisted.queue).toEqual([]);
  await page.getByRole("button", { name: "Diğer", exact: true }).click();
  await page.getByRole("button", { name: /Çıkış yap/ }).click();
  await expect(page.getByRole("heading", { name: "Yerel yönetici hesabını oluşturun." })).toBeVisible();
});

test("local Android records queue once and acknowledge server synchronization", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    (window as typeof window & { capturedSync?: unknown; ClinicNovaNative?: { sync: (url: string, batch: string) => void; productSearch: (url: string, query: string, itemId: string) => void }; ClinicNovaSyncResult?: (status: number, body: string) => void; ClinicNovaProductSearchResult?: (status: number, body: string, itemId: string) => void }).ClinicNovaNative = {
      sync(_url, batch) {
        const parsed = JSON.parse(batch) as { operations: Array<{ operationId: string }> };
        (window as typeof window & { capturedSync?: unknown }).capturedSync = parsed;
        setTimeout(() => (window as typeof window & { ClinicNovaSyncResult?: (status: number, body: string) => void }).ClinicNovaSyncResult?.(200, JSON.stringify({ synced: parsed.operations.length, failed: 0, results: parsed.operations.map((item, index) => ({ operationId: item.operationId, status: "synced", serverEntityId: `server-${index}` })) })), 10);
      },
      productSearch(_url, productUrl, itemId) {
        (window as typeof window & { capturedProductUrl?: string }).capturedProductUrl = productUrl;
        setTimeout(() => (window as typeof window & { ClinicNovaProductSearchResult?: (status: number, body: string, itemId: string) => void }).ClinicNovaProductSearchResult?.(200, JSON.stringify({ checkedAt: "2026-07-16T18:00:00.000Z", offers: [
          { seller: "Dental Ucuz", unitPrice: 100, shippingPrice: 5, productUrl, inStock: true }
        ] }), itemId), 10);
      }
    };
  });
  await page.goto(mobileUrl);
  await page.getByLabel("Klinik adı").fill("Sync Klinik");
  await page.getByLabel("Yönetici adı").fill("Sync Yönetici");
  await page.getByLabel("E-posta").fill("sync@clinic.test");
  await page.getByLabel("Parola").fill("GuvenliSyncParola!2026");
  await page.getByRole("button", { name: "Hesabı oluştur ve başla" }).click();
  await page.getByRole("button", { name: "Anladım, kaydettim" }).click();
  await page.getByRole("button", { name: "Hasta ekle" }).first().click();
  await page.locator('#patientForm input[name="name"]').fill("Yerel Hasta");
  await page.locator('#patientForm input[name="phone"]').fill("+90 555 222 33 44");
  await page.getByRole("button", { name: "Hastayı kaydet" }).click();
  await expect(page.getByRole("status")).toContainText("Hasta başarıyla kaydedildi");
  await page.evaluate(() => localStorage.setItem("clinicnova.serverUrl", JSON.stringify("https://clinic.example.test")));
  await page.reload();
  await page.getByLabel("Parola").fill("GuvenliSyncParola!2026");
  await page.getByRole("button", { name: "Çevrimdışı giriş yap" }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { capturedSync?: { operations?: unknown[] } }).capturedSync?.operations?.length ?? 0)).toBe(1);
  await expect(page.getByText("Senkronlandı", { exact: true })).toBeVisible();
  const operation = await page.evaluate(() => (window as typeof window & { capturedSync?: { operations: Array<{ entityType: string; action: string; payload: { name: string } }> } }).capturedSync!.operations[0]);
  expect(operation).toMatchObject({ entityType: "PATIENT", action: "CREATE", payload: { name: "Yerel Hasta" } });
  await page.getByRole("button", { name: "Stok", exact: true }).click();
  await page.getByRole("button", { name: "Stok ürünü ekle" }).click();
  await page.locator('#stockItemForm input[name="name"]').fill("Anestezi kartuşu");
  await page.locator('#stockItemForm input[name="category"]').fill("Sarf");
  await page.locator('#stockItemForm input[name="amount"]').fill("10");
  await page.locator('#stockItemForm input[name="minimum"]').fill("5");
  await page.getByRole("button", { name: "Ürünü kaydet" }).click();
  await page.locator("#stockList").getByRole("button", { name: /Anestezi kartuşu/ }).click();
  await page.getByRole("button", { name: "Satın alma sayfası ekle" }).click();
  await page.locator('#stockOfferForm input[name="productUrl"]').fill("https://shop.example/anestezi-kartusu");
  await page.getByRole("button", { name: "Fiyatı getir" }).click();
  await expect(page.getByText("Dental Ucuz", { exact: true })).toBeVisible();
  await expect(page.locator(".purchase-list .purchase-row").first()).toContainText("Dental Ucuz");
  await expect.poll(() => page.evaluate(() => (window as typeof window & { capturedProductUrl?: string }).capturedProductUrl)).toBe("https://shop.example/anestezi-kartusu");
});

test("Android exposes the new parity modules and their offline CRUD forms", async ({ page }) => {
  test.setTimeout(45_000);
  await page.addInitScript(() => {
    (window as typeof window & { CLINICNOVA_MOBILE_CONFIG?: { mode: string; serverUrl: string } }).CLINICNOVA_MOBILE_CONFIG = { mode: "demo", serverUrl: "" };
  });
  await page.goto(mobileUrl);
  await page.getByRole("button", { name: "Demo girişi" }).click();
  await page.getByRole("button", { name: "Diğer", exact: true }).click();

  await page.locator("#moduleGrid").getByRole("button", { name: /Gerçekleşen tedaviler/ }).click();
  await page.getByRole("button", { name: "Tedavi kaydı ekle" }).click();
  await page.locator('#treatmentForm input[name="treatment"]').fill("Parite dolgusu");
  await page.locator('#treatmentForm input[name="fee"]').fill("2500");
  const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZST8AAAAASUVORK5CYII=", "base64");
  await page.locator('#treatmentForm input[name="beforePhoto"]').setInputFiles({ name: "before.png", mimeType: "image/png", buffer: pixel });
  await page.locator('#treatmentForm input[name="afterPhoto"]').setInputFiles({ name: "after.png", mimeType: "image/png", buffer: pixel });
  await page.locator("#treatmentForm").getByRole("button", { name: "Kaydet" }).click();
  await expect(page.locator("#modalBody")).toContainText("Parite dolgusu");
  await expect(page.locator(".treatment-photo-pair img")).toHaveCount(2);

  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.locator("#moduleGrid").getByRole("button", { name: /Personel/ }).click();
  await page.getByRole("button", { name: "Personel ekle" }).click();
  await page.locator('#staffForm input[name="fullName"]').fill("Mobil Asistan");
  await page.locator('#staffForm input[name="roleLabel"]').fill("Diş hekimi asistanı");
  await page.locator("#staffForm").getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Mobil Asistan", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.locator("#moduleGrid").getByRole("button", { name: /Anketler/ }).click();
  await page.getByRole("button", { name: "Anket oluştur" }).click();
  await page.locator('#surveyForm input[name="title"]').fill("Mobil memnuniyet");
  await page.getByRole("button", { name: "Anketi kaydet" }).click();
  await expect(page.getByText("Mobil memnuniyet", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.locator("#moduleGrid").getByRole("button", { name: /Recall/ }).click();
  await page.getByRole("button", { name: "Takip ekle" }).click();
  await page.locator('#recallForm input[name="reason"]').fill("Altı aylık kontrol");
  await page.getByRole("button", { name: "Takibi kaydet" }).click();
  await expect(page.locator("#modalBody")).toContainText("Altı aylık kontrol");
  let reminderRequest: Record<string, unknown> | null = null;
  await page.route("https://messages.example.test/reminder", async (route) => {
    reminderRequest = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  await page.locator('#reminderSettingsForm input[name="enabled"]').check();
  await page.locator('#reminderSettingsForm input[name="endpoint"]').fill("https://messages.example.test/reminder");
  await page.locator('#reminderSettingsForm input[name="token"]').fill("test-provider-token");
  await page.locator("#reminderSettingsForm").getByRole("button", { name: "Hatırlatma ayarlarını kaydet" }).click();
  await page.evaluate(() => (window as typeof window & { ClinicNovaProcessReminders: () => Promise<void> }).ClinicNovaProcessReminders());
  await expect.poll(() => reminderRequest).not.toBeNull();
  expect(reminderRequest).toMatchObject({ channel: "WHATSAPP", appointmentId: "5" });

  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.locator("#moduleGrid").getByRole("button", { name: /Tam web paneli/ })).toBeVisible();
});
