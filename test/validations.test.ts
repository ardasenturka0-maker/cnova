import assert from "node:assert/strict";
import test from "node:test";
import { loginSchema, registerSchema } from "../src/lib/validations/auth";
import { paginationSchema } from "../src/lib/validations/common";
import { portalLoginSchema } from "../src/lib/validations/portal";
import { paymentSchema } from "../src/lib/validations/finance";
import { stockMovementSchema, stockOfferSchema } from "../src/lib/validations/stock";
import { canAccess } from "../src/lib/rbac";
import { Role } from "@prisma/client";
import { mobileSyncBatchSchema } from "../src/lib/validations/mobile-sync";

test("login validation normalizes e-mail addresses", () => {
  const result = loginSchema.parse({ email: "OWNER@CLINICNOVA.TEST", password: "password123" });
  assert.equal(result.email, "owner@clinicnova.test");
});

test("registration rejects weak passwords", () => {
  const result = registerSchema.safeParse({ clinicName: "Nova", fullName: "Tuna Akın", email: "tuna@example.com", password: "short" });
  assert.equal(result.success, false);
});

test("pagination applies safe defaults and limits", () => {
  assert.deepEqual(paginationSchema.parse({}), { page: 1, pageSize: 25 });
  assert.equal(paginationSchema.safeParse({ pageSize: 101 }).success, false);
});

test("patient portal requires a scoped clinic code and birth date", () => {
  const valid = portalLoginSchema.parse({ organizationSlug: " Nova-Dental ", phone: "+90 532 555 10 00", birthDate: "1980-01-01" });
  assert.equal(valid.organizationSlug, "nova-dental");
  assert.equal(portalLoginSchema.safeParse({ organizationSlug: "nova-dental", phone: "+90 532 555 10 00" }).success, false);
  assert.equal(portalLoginSchema.safeParse({ organizationSlug: "../other", phone: "+90 532 555 10 00", birthDate: "1980-01-01" }).success, false);
});

test("payment records preserve the deposit selection", () => {
  const result = paymentSchema.parse({ type: "INCOME", amount: "1000", method: "CARD", status: "PAID", isDeposit: "on" });
  assert.equal(result.isDeposit, true);
});

test("stock purchase offers require a secure product link", () => {
  const base = { itemId: "stock_1", seller: "Dental Market", unitPrice: "250", shippingPrice: "20", inStock: "on" };
  assert.equal(stockOfferSchema.safeParse({ ...base, productUrl: "http://shop.example/product" }).success, false);
  assert.equal(stockOfferSchema.parse({ ...base, productUrl: "https://shop.example/product" }).inStock, true);
});

test("stock adjustment can set zero while entry and exit cannot", () => {
  assert.equal(stockMovementSchema.safeParse({ itemId: "stock_1", type: "ADJUSTMENT", quantity: 0 }).success, true);
  assert.equal(stockMovementSchema.safeParse({ itemId: "stock_1", type: "IN", quantity: 0 }).success, false);
  assert.equal(stockMovementSchema.safeParse({ itemId: "stock_1", type: "OUT", quantity: 0 }).success, false);
});

test("role permissions hide financial and stock data from reception", () => {
  assert.equal(canAccess(Role.RECEPTIONIST, "finance"), false);
  assert.equal(canAccess(Role.RECEPTIONIST, "stocks"), false);
  assert.equal(canAccess(Role.CLINIC_OWNER, "recalls"), true);
});

test("mobile sync batches are bounded and require stable operation identities", () => {
  const operation = { operationId: "operation-123", entityType: "PATIENT", action: "CREATE", clientId: "local-1", createdAt: new Date().toISOString(), payload: { name: "Yerel Hasta" } };
  assert.equal(mobileSyncBatchSchema.safeParse({ deviceId: "android-device-1", operations: [operation] }).success, true);
  assert.equal(mobileSyncBatchSchema.safeParse({ deviceId: "short", operations: [operation] }).success, false);
  assert.equal(mobileSyncBatchSchema.safeParse({ deviceId: "android-device-1", operations: [] }).success, true);
});

test("mobile sync accepts every Android parity entity and rejects unknown modules", () => {
  const entityTypes = ["TREATMENT", "STAFF", "CONSENT", "SURVEY", "SURVEY_RESPONSE", "COMMUNICATION", "RECALL"];
  for (const entityType of entityTypes) {
    const operation = { operationId: `operation-${entityType}`, entityType, action: "CREATE", clientId: `local-${entityType}`, createdAt: new Date().toISOString(), payload: {} };
    assert.equal(mobileSyncBatchSchema.safeParse({ deviceId: "android-device-1", operations: [operation] }).success, true, entityType);
  }
  const invalid = { operationId: "operation-unknown", entityType: "AUDIT_OVERRIDE", action: "CREATE", clientId: "local-unknown", createdAt: new Date().toISOString(), payload: {} };
  assert.equal(mobileSyncBatchSchema.safeParse({ deviceId: "android-device-1", operations: [invalid] }).success, false);
});
