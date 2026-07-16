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

test("bundled Android interface works offline", async ({ page }) => {
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

  await page.locator(".bottom-nav").getByRole("button", { name: "Tedaviler", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tedavi planları" })).toBeVisible();
  await page.getByRole("button", { name: "Tedavi planı ekle", exact: true }).click();
  await page.locator('#treatmentPlanForm select[name="patientId"]').selectOption({ label: "Ayşe Yılmaz" });
  await page.locator('#treatmentPlanForm input[name="treatment"]').fill("Zirkonyum kaplama");
  await page.locator('#treatmentPlanForm input[name="tooth"]').fill("11-21");
  await page.locator('#treatmentPlanForm input[name="total"]').fill("24000");
  await page.locator('#treatmentPlanForm input[name="paid"]').fill("4000");
  await page.locator('#treatmentPlanForm textarea[name="note"]').fill("Dijital ölçü sonrası renk provası yapılacak.");
  await page.getByRole("button", { name: "Tedavi planını kaydet" }).click();
  const newPlan = page.locator("#treatmentPlanList").getByRole("button", { name: /Zirkonyum kaplama/ });
  await expect(newPlan).toBeVisible();
  await newPlan.click();
  await expect(page.getByText("11-21", { exact: true })).toBeVisible();
  await expect(page.locator("#modalBody")).toContainText("Dijital ölçü sonrası renk provası yapılacak.");
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
  await page.getByRole("button", { name: "Satın alma fiyatı ekle" }).click();
  await page.locator('#stockOfferForm input[name="seller"]').fill("Medikal Market");
  await page.locator('#stockOfferForm input[name="unitPrice"]').fill("100");
  await page.locator('#stockOfferForm input[name="shippingPrice"]').fill("10");
  await page.locator('#stockOfferForm input[name="productUrl"]').fill("https://example.com/maske");
  await page.getByRole("button", { name: "Fiyatı kaydet" }).click();
  await expect(page.getByText("Medikal Market", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Kapat", exact: true }).click();

  await page.locator(".bottom-nav").getByRole("button", { name: "Randevu", exact: true }).click();
  await expect(page.locator("#dateStrip .date-button")).toHaveCount(42);
  await page.locator("#appointmentList .appointment-card").filter({ hasText: "Zeynep Çelik" }).click();
  await page.getByLabel("Durum").selectOption("COMPLETED");
  await page.getByRole("button", { name: "Durumu güncelle" }).click();
  await page.locator(".bottom-nav").getByRole("button", { name: "Stok", exact: true }).click();
  await expect(page.locator("#stockList").getByRole("button", { name: /Maske/ })).toContainText("5");
  await page.locator(".bottom-nav").getByRole("button", { name: "Randevu", exact: true }).click();
  await page.locator("#appointmentList .appointment-card").filter({ hasText: "Zeynep Çelik" }).click();
  await page.getByLabel("Durum").selectOption("PLANNED");
  await page.getByRole("button", { name: "Durumu güncelle" }).click();
  await page.locator(".bottom-nav").getByRole("button", { name: "Stok", exact: true }).click();
  await expect(page.locator("#stockList").getByRole("button", { name: /Maske/ })).toContainText("7");
  await page.locator(".bottom-nav").getByRole("button", { name: "Randevu", exact: true }).click();
  await page.getByRole("button", { name: "Sonraki ay" }).click();
  await expect(page.locator("#calendarMonthLabel")).not.toBeEmpty();

  await page.getByRole("button", { name: "Diğer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Diğer", exact: true })).toHaveAttribute("aria-current", "page");
  const moduleCases: Array<[string, string, string | null]> = [
    ["Sağlık turizmi", "John Smith", "John Smith lead kaydını sil"],
    ["İletişim", "Demo taslak", "Emily Carter iletişim kaydını sil"],
    ["Raporlar", "Net akış", null],
    ["Dijital onam", "İmza bekliyor", "Emily Carter onam kaydını sil"]
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

test("local Android records queue once and acknowledge server synchronization", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    (window as typeof window & { capturedSync?: unknown; ClinicNovaNative?: { sync: (url: string, batch: string) => void }; ClinicNovaSyncResult?: (status: number, body: string) => void }).ClinicNovaNative = {
      sync(_url, batch) {
        const parsed = JSON.parse(batch) as { operations: Array<{ operationId: string }> };
        (window as typeof window & { capturedSync?: unknown }).capturedSync = parsed;
        setTimeout(() => (window as typeof window & { ClinicNovaSyncResult?: (status: number, body: string) => void }).ClinicNovaSyncResult?.(200, JSON.stringify({ synced: parsed.operations.length, failed: 0, results: parsed.operations.map((item, index) => ({ operationId: item.operationId, status: "synced", serverEntityId: `server-${index}` })) })), 10);
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
});
