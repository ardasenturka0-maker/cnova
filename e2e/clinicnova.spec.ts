import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const currentVersion = JSON.parse(readFileSync("package.json", "utf8")).version as string;

test("public experience is responsive and sends security headers", async ({ page }, testInfo) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hasta kaydından tedaviye");
  await expect(page.getByRole("link", { name: "Gizlilik" })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");

  const demoLink = page.getByRole("link", { name: "Demo Talep Et" }).first();
  await demoLink.focus();
  const focusedStyle = await demoLink.evaluate((element) => getComputedStyle(element).boxShadow);
  expect(focusedStyle, "Klavye odağı görünür bir halka göstermeli").not.toBe("none");

  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["permissions-policy"]).toContain("camera=(self)");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(horizontalOverflow, `${testInfo.project.name} görünümünde yatay taşma var`).toBe(false);

  await page.goto("/showcase/nova-dental-demo");
  await expect(page.getByRole("heading", { name: "Önce / Sonra Vakaları" })).toBeVisible();
  await expect(page.getByText("Sonuçlar kişiden kişiye değişebilir.")).toBeVisible();

  await page.goto("/forgot-password");
  await page.getByLabel("E-posta").fill("owner@clinicnova.test");
  await page.getByRole("button", { name: "Şifre bağlantısı gönder" }).click();
  await expect(page.getByText("Hesap bulunursa şifre yenileme bağlantısı e-posta ile gönderilir.")).toBeVisible();

  await page.goto("/faq");
  await expect(page.getByText(/Windows, macOS ve Android'e kurulabilir/)).toBeVisible();
  await expect(page.getByText(/yerel yönetici hesabı ve parola oluşturulur/)).toBeVisible();
});

test("outdated signed Android clients receive the secure update notice", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "userAgent", { value: `${navigator.userAgent} ClinicNovaAndroid/1.1.2`, configurable: true }));
  await page.goto("/login");
  const update = page.getByRole("link", { name: "İmzalı APK’yı güncelle" });
  await expect(update).toBeVisible();
  await expect(update).toHaveAttribute("href", `https://download.example.test/ClinicNova-${currentVersion}.apk`);
  const manifest = await page.request.get("/api/mobile/version");
  expect(manifest.status()).toBe(200);
  expect(await manifest.json()).toMatchObject({ currentVersion, minimumVersion: currentVersion, sha256: "a".repeat(64) });
});

test("staff login never exposes validation or internal error details", async ({ page }) => {
  const invalid = await page.request.post("/api/auth/login", { data: { email: "not-an-email", password: "short" } });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toEqual({ error: "Giriş bilgileri geçersiz." });
});

test("health tourism pages and external entrypoints are removed", async ({ page }) => {
  for (const path of ["/package/pkg-demo-1", "/survey/pkg-demo-1", "/care-check/demo", "/api/cron/followups", "/api/webhooks/n8n/leads", "/api/webhooks/n8n/reservation-share"]) {
    expect((await page.request.get(path)).status(), path).toBe(404);
  }
  await page.goto("/demo-open");
  expect((await page.request.get("/dashboard/tourism")).status()).toBe(404);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /Sağlık Turizmi|Health Tourism/ })).toHaveCount(0);
});

test("demo can open without a live database", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Demo olarak incele" })).toBeVisible();
  await page.getByRole("link", { name: "Demo olarak incele" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Klinik dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Geciken tahsilatlar" })).toBeVisible();
});

test("sales workflows expose full calendar, treatment details, stock purchasing and deposits", async ({ page }) => {
  await page.goto("/demo-open");
  await page.goto("/dashboard/treatment-plans");
  const planHref = await page.locator("tbody a").first().getAttribute("href");
  expect(planHref).toMatch(/^\/dashboard\/treatment-plans\//);
  await page.goto(planHref!);
  await expect(page).toHaveURL(/\/dashboard\/treatment-plans\/.+/);
  await expect(page.getByRole("link", { name: "Planlara dön" })).toBeVisible();
  await expect(page.getByText("Tahmini ücret", { exact: true })).toBeVisible();

  await page.goto("/dashboard/appointments");
  await expect(page.locator("[data-calendar-day]")).toHaveCount(42);
  await expect(page.getByRole("link", { name: "Önceki ay" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sonraki ay" })).toBeVisible();

  await page.goto("/dashboard/stocks");
  await expect(page.getByRole("heading", { name: "Ürün satın alma ve fiyat karşılaştırma" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ürün ekle" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stok hareketi" })).toBeVisible();

  await page.goto("/dashboard/payments");
  await expect(page.getByLabel("Bu tahsilat peşinattır")).toBeVisible();
});

test("staff can be removed from the active roster without losing its record", async ({ page }) => {
  await page.goto("/demo-open");
  await page.goto("/dashboard/staff");
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "Seda Resepsiyon", exact: true }) });
  await row.getByRole("button", { name: "Personeli çıkar" }).click();
  await expect(row).toContainText("Pasif");
  await expect(row.getByRole("button", { name: "Yeniden aktifleştir" })).toBeVisible();
  await row.getByRole("button", { name: "Yeniden aktifleştir" }).click();
  await expect(row).toContainText("Aktif");
  await expect(row.getByRole("button", { name: "Personeli çıkar" })).toBeVisible();
});

test("completed treatments consume their material recipe and reversal returns stock", async ({ page }, testInfo) => {
  await page.goto("/demo-open");
  const suffix = `${testInfo.project.name === "android-chrome" ? "mobil" : "masaustu"}-${Date.now()}-${testInfo.retry}`;
  const stockName = `Otomatik sarf ${suffix}`;
  const treatmentName = `Reçeteli işlem ${suffix}`;

  await page.goto("/dashboard/stocks");
  const stockForm = page.locator('form').filter({ has: page.locator('input[name="currentQuantity"]') });
  await stockForm.locator('input[name="name"]').fill(stockName);
  await stockForm.locator('input[name="category"]').fill("Sarf");
  await stockForm.locator('input[name="currentQuantity"]').fill("5");
  await stockForm.locator('input[name="minimumQuantity"]').fill("1");
  await stockForm.locator('input[name="unit"]').fill("adet");
  await stockForm.getByRole("button", { name: "Ürün Kaydet" }).click();
  const stockRow = () => page.getByRole("row").filter({ has: page.getByRole("cell", { name: stockName, exact: true }) }).filter({ has: page.getByRole("cell", { name: "Sarf", exact: true }) });
  await expect(stockRow()).toContainText("5 adet");

  const recipeForm = page.locator('form').filter({ has: page.locator('input[name="treatmentType"]') });
  await recipeForm.locator('input[name="treatmentType"]').fill(treatmentName);
  await recipeForm.locator('select[name="itemId"]').selectOption({ label: `${stockName} · 5 adet` });
  await recipeForm.locator('input[name="quantity"]').fill("2");
  await recipeForm.getByRole("button", { name: "Reçeteye Ekle" }).click();
  await expect(page.getByRole("row").filter({ hasText: treatmentName })).toContainText(`${stockName}`);

  await page.goto("/dashboard/treatments");
  const treatmentForm = page.locator('form:has(button:has-text("Tedavi Kaydet"))');
  await treatmentForm.locator('select[name="patientId"]').selectOption({ index: 1 });
  await treatmentForm.locator('select[name="doctorId"]').selectOption({ index: 1 });
  await treatmentForm.locator('input[name="treatmentType"]').fill(treatmentName);
  await treatmentForm.locator('select[name="status"]').selectOption("COMPLETED");
  await treatmentForm.getByRole("button", { name: "Tedavi Kaydet" }).click();

  await page.goto("/dashboard/stocks");
  await expect(stockRow()).toContainText("3 adet");

  await page.goto("/dashboard/treatments");
  const treatmentRow = page.getByRole("row").filter({ hasText: treatmentName });
  await treatmentRow.getByLabel(`${treatmentName} durumu`).selectOption("STARTED");
  await treatmentRow.getByRole("button", { name: "Kaydet" }).click();
  await page.goto("/dashboard/stocks");
  await expect(stockRow()).toContainText("5 adet");
});

test("operational writes preserve tenant and accounting integrity", async ({ page }, testInfo) => {
  await page.goto("/demo-open");

  const financeResponse = await page.request.get("/api/payments");
  expect(financeResponse.status()).toBe(200);
  const finance = await financeResponse.json();
  const treatment = finance.treatments[0];
  const activePatient = finance.patients[0];

  const badAppointment = await page.request.post("/api/appointments", { data: {
    patientId: activePatient.id, doctorId: "doctor_from_another_clinic", startsAt: "2027-01-10T10:00", durationMinutes: 30,
    treatmentType: "Kontrol", status: "PLANNED"
  } });
  expect(badAppointment.status()).toBe(400);
  expect((await badAppointment.json()).error).toMatch(/doktor/i);

  const otherPatient = finance.patients.find((patient: { id: string }) => patient.id !== treatment.patientId);
  const mismatchedPayment = await page.request.post("/api/payments", { data: {
    patientId: otherPatient.id, treatmentId: treatment.id, type: "INCOME", amount: 100, method: "CARD", status: "PAID", isDeposit: true
  } });
  expect(mismatchedPayment.status()).toBe(400);
  expect((await mismatchedPayment.json()).error).toMatch(/bu hastaya ait değil/i);

  const name = `Test ürün ${testInfo.project.name}`;
  const createdResponse = await page.request.post("/api/stocks", { data: {
    name, category: "Test", currentQuantity: 7, minimumQuantity: 2, unit: "adet", supplier: "Test", purchasePrice: 10
  } });
  expect(createdResponse.status()).toBe(201);
  const created = (await createdResponse.json()).stock;
  const afterCreate = await (await page.request.get("/api/stocks")).json();
  const createdItem = afterCreate.stocks.find((item: { id: string }) => item.id === created.id);
  expect(createdItem.movements[0]).toMatchObject({ type: "IN", quantity: 7, note: "Açılış stoku" });

  const zeroAdjustment = await page.request.post("/api/stocks/movement", { data: { itemId: created.id, type: "ADJUSTMENT", quantity: 0, note: "Sayım" } });
  expect(zeroAdjustment.status()).toBe(201);
  const afterAdjustment = await (await page.request.get("/api/stocks")).json();
  expect(afterAdjustment.stocks.find((item: { id: string }) => item.id === created.id).currentQuantity).toBe(0);
});

test("patient portal scopes identity and revokes a deleted patient's session", async ({ page }, testInfo) => {
  await page.goto("/demo-open");
  const suffix = `${testInfo.project.name === "android-chrome" ? "902" : "901"}${testInfo.retry}`;
  const patient = {
    phone: `+90 555 000 ${suffix}`,
    birthDate: "1990-01-10",
    wrongBirthDate: "1990-01-11",
    name: `Portal Test ${suffix}`
  };
  const createdResponse = await page.request.post("/api/patients", { data: {
    firstName: "Portal Test", lastName: suffix, phone: patient.phone, birthDate: patient.birthDate,
    gender: "UNSPECIFIED", tag: "ACTIVE"
  } });
  expect(createdResponse.status()).toBe(201);
  const patientId = (await createdResponse.json()).patient.id;

  await page.goto("/portal/login");
  await page.getByLabel("Telefon numaranız").fill(patient.phone);
  await page.getByLabel("Doğum tarihiniz").fill(patient.wrongBirthDate);
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/portal\/login\?error=1$/);

  await page.getByLabel("Telefon numaranız").fill(patient.phone);
  await page.getByLabel("Doğum tarihiniz").fill(patient.birthDate);
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: `Merhaba, ${patient.name}` })).toBeVisible();

  await page.goto("/demo-open");
  await page.goto(`/dashboard/patients/${patientId}`);
  await page.getByRole("button", { name: "Hastayı Sil" }).click();
  await expect(page).toHaveURL(/\/dashboard\/patients$/);

  await page.goto("/portal");
  await expect(page).toHaveURL(/\/portal\/login\?error=inactive$/);

  await page.goto("/dashboard/patients/trash");
  await expect(page.getByText(patient.name)).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: patient.name });
  await row.getByRole("button", { name: "Geri yükle" }).click();
  await expect(page.getByText(patient.name)).toHaveCount(0);
});

const primaryDashboardRoutes = [
  "/dashboard",
  "/dashboard/patients",
  "/dashboard/patients/new",
  "/dashboard/appointments",
  "/dashboard/treatments",
  "/dashboard/treatment-plans",
  "/dashboard/payments",
  "/dashboard/invoices",
  "/dashboard/finance",
  "/dashboard/stocks",
  "/dashboard/staff",
  "/dashboard/doctors",
  "/dashboard/consents",
  "/dashboard/surveys",
  "/dashboard/communication",
  "/dashboard/recalls",
  "/dashboard/reports",
  "/dashboard/settings"
];

test("all primary application modules render without runtime errors or horizontal overflow", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`${page.url()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => pageErrors.push(`${page.url()}: ${error.message}`));

  await page.goto("/login");
  await page.getByLabel("E-posta").fill("owner@clinicnova.test");
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  for (const route of primaryDashboardRoutes) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${route} HTTP durum kodu`).toBeLessThan(400);
    await expect(page.locator("main h1").first(), `${route} ana başlığı`).toBeVisible();
    const overflow = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      layout: Array.from(document.querySelectorAll("body, body > div, header, main, main > div"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            className: typeof element.className === "string" ? element.className : "",
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            overflowX: getComputedStyle(element).overflowX
          };
        }),
      elements: Array.from(document.querySelectorAll("body *"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          let ancestor = element.parentElement;
          let clippedByAncestor = false;
          while (ancestor && ancestor !== document.body) {
            const overflowX = getComputedStyle(ancestor).overflowX;
            if (["auto", "scroll", "hidden", "clip"].includes(overflowX)) {
              clippedByAncestor = true;
              break;
            }
            ancestor = ancestor.parentElement;
          }
          return {
            tag: element.tagName.toLowerCase(),
            className: typeof element.className === "string" ? element.className : "",
            text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "",
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            clippedByAncestor
          };
        })
        .filter((element) => !element.clippedByAncestor && (element.right > document.documentElement.clientWidth + 1 || element.left < -1))
        .slice(0, 20)
    }));
    expect(overflow.pageWidth, `${testInfo.project.name} ${route} düzen: ${JSON.stringify(overflow.layout)} taşan öğeler: ${JSON.stringify(overflow.elements)}`).toBe(overflow.viewportWidth);
  }

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("reception staff cannot delete patient records", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill("receptionist@clinicnova.test");
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş Yap" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const response = await page.request.delete("/api/patients/patient_02");
  expect(response.status()).toBe(403);
  await page.goto("/dashboard/patients/patient_02");
  await expect(page.getByRole("heading", { name: "Mehmet Demir" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hastayı Sil" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Stok" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Finans" })).toHaveCount(0);
  await page.goto("/dashboard/stocks");
  await expect(page).toHaveURL(/\/dashboard\?error=forbidden$/);
  expect((await page.request.get("/api/stocks")).status()).toBe(403);
  expect((await page.request.get("/api/payments")).status()).toBe(403);
  expect((await page.request.get("/api/reports/export")).status()).toBe(403);
});

test("staff can sign in, use the dashboard and sign out", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await page.getByLabel("E-posta").fill("owner@clinicnova.test");
  await page.getByLabel("Şifre").fill("password123");
  await page.getByRole("button", { name: "Giriş Yap" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Klinik dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aylık gelir", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Geciken tahsilatlar" })).toBeVisible();

  if (testInfo.project.name === "android-chrome") {
    await page.getByRole("button", { name: "Menü" }).click();
    await expect(page.getByRole("link", { name: "Hastalar" })).toBeVisible();
    await page.getByRole("button", { name: "Kapat", exact: true }).click();
  }

  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /Sağlık Turizmi|Health Tourism/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Bildirimler" }).click();
  await expect(page.getByText(/lead|paket kabul/i)).toHaveCount(0);

  await page.goto("/dashboard");
  const dashboardOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(dashboardOverflow, `${testInfo.project.name} dashboard görünümünde yatay taşma var`).toBe(false);

  const health = await page.request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", service: "clinicnova", version: currentVersion });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
