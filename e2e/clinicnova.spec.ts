import { expect, test } from "@playwright/test";

test("public experience is responsive and sends security headers", async ({ page }, testInfo) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Lead’den tedaviye");
  await expect(page.getByRole("link", { name: "Gizlilik" })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");

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
});

test("a public package can be accepted only once", async ({ page }, testInfo) => {
  const token = testInfo.project.name === "android-chrome" ? "pkg-demo-5" : "pkg-demo-1";
  await page.goto(`/package/${token}`);
  await expect(page.getByRole("button", { name: /Paketi Kabul Ediyorum|I Accept This Package/ })).toBeVisible();
  await page.getByRole("button", { name: /Paketi Kabul Ediyorum|I Accept This Package/ }).click();
  await expect(page.getByText(/Paket kabul edildi|This package has been accepted/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Paketi Kabul Ediyorum|I Accept This Package/ })).toHaveCount(0);
});

test("demo can open without a live database", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Demo olarak incele" })).toBeVisible();
  await page.getByRole("link", { name: "Demo olarak incele" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Klinik dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gelir fırsatları hazır" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Gelir fırsatları hazır" })).toBeVisible();

  if (testInfo.project.name === "android-chrome") {
    await page.getByRole("button", { name: "Menü" }).click();
    await expect(page.getByRole("link", { name: "Hastalar" })).toBeVisible();
    await page.getByRole("button", { name: "Kapat", exact: true }).click();
  }

  await page.getByRole("link", { name: /sıcak lead/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/tourism\/leads$/);
  await expect(page.getByRole("heading", { name: "Lead Havuzu" })).toBeVisible();

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Bildirimler" }).click();
  await page.getByRole("link", { name: /Yeni sıcak lead/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/tourism\/leads$/);

  await page.goto("/dashboard");
  const dashboardOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(dashboardOverflow, `${testInfo.project.name} dashboard görünümünde yatay taşma var`).toBe(false);

  const health = await page.request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", service: "clinicnova", version: "1.1.1" });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
