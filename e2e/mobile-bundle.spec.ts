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
  await page.getByRole("button", { name: "Diğer", exact: true }).click();
  await page.getByRole("button", { name: /^Stok/ }).click();
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

  await page.locator("#patientList").getByRole("button", { name: /Tuna Akın/ }).click();
  await page.getByRole("button", { name: "Yeni randevu oluştur" }).click();
  await expect(page.getByRole("combobox", { name: "Hasta", exact: true }).locator("option:checked")).toHaveText("Tuna Akın");
  await page.getByRole("button", { name: "Randevuyu kaydet" }).click();
  await expect(page.locator("#appointmentList").getByText("Tuna Akın", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Ana Sayfa", exact: true }).click();
  await page.getByRole("button", { name: "Ödeme al" }).click();
  await page.getByRole("combobox", { name: "Hasta", exact: true }).selectOption({ label: "Tuna Akın" });
  await page.getByLabel("Tutar").fill("1250");
  await page.getByRole("button", { name: "Ödemeyi kaydet" }).click();
  await expect(page.getByRole("heading", { name: "Tahsilat merkezi" })).toBeVisible();
  await expect(page.locator("#transactionList").getByText("Tuna Akın", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Ana Sayfa", exact: true }).click();
  await page.getByRole("button", { name: "Bildirimler" }).click();
  await page.getByRole("button", { name: /Yeni sağlık turizmi lead/ }).click();
  await expect(page.getByRole("heading", { name: "Bugünkü fırsatlar" })).toBeVisible();

  await page.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.getByRole("button", { name: "Diğer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Diğer", exact: true })).toHaveAttribute("aria-current", "page");
  for (const [module, expected] of [
    ["Tedavi planları", "Ayşe Yılmaz"],
    ["Sağlık turizmi", "John Smith"],
    ["Stok", "Anestezi kartuşu"],
    ["İletişim", "Demo taslak"],
    ["Raporlar", "Net akış"],
    ["Dijital onam", "İmza bekliyor"]
  ]) {
    await page.getByRole("button", { name: new RegExp(`^${module}`) }).click();
    await expect(page.getByRole("heading", { name: module })).toBeVisible();
    await expect(page.locator("#modalBody").getByText(expected, { exact: true }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: new RegExp(`^${module}`) })).toBeFocused();
  }

  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  expect(errors).toEqual([]);
});

test("production Android bootstrap requires a secure ClinicNova server", async ({ page }) => {
  await page.goto(mobileUrl);
  await expect(page.getByRole("heading", { name: "Kliniğinizi güvenle bağlayın." })).toBeVisible();
  await expect(page.getByLabel("ClinicNova sunucu adresi")).toBeVisible();
  await expect(page.getByLabel("E-posta")).toBeHidden();
  await expect(page.getByLabel("Şifre")).toBeHidden();
  await expect(page.getByRole("button", { name: "Demo olarak incele" })).toBeVisible();

  await page.getByLabel("ClinicNova sunucu adresi").fill("http://guvensiz.example.com");
  await page.getByRole("button", { name: "Güvenli sisteme bağlan" }).click();
  await expect(page.getByRole("status")).toContainText("Geçerli bir HTTPS ClinicNova adresi girin.");
  await expect(page).toHaveURL(mobileUrl);

  await page.getByRole("button", { name: "Demo olarak incele" }).click();
  await expect(page.getByRole("heading", { name: /Günaydın/ })).toBeVisible();
});
