import assert from "node:assert/strict";
import test from "node:test";
import { loginSchema, registerSchema } from "../src/lib/validations/auth";
import { paginationSchema } from "../src/lib/validations/common";
import { portalLoginSchema } from "../src/lib/validations/portal";

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
