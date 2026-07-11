import { expect, test } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";

const mobileUrl = pathToFileURL(path.resolve("mobile/assets/index.html")).href;

test("bundled Android interface works offline", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(mobileUrl);
  await expect(page.getByRole("heading", { name: "Kliniğiniz cebinizde." })).toBeVisible();
  await page.getByRole("button", { name: "Giriş Yap" }).click();
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
  await page.getByLabel("Ad soyad").fill("Tuna Akın");
  await page.getByLabel("Telefon").fill("+90 555 000 00 00");
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

  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  expect(errors).toEqual([]);
});
