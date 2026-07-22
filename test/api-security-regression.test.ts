import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { StockMovementType } from "@prisma/client";
import { isClinicDateOverdue } from "../src/lib/clinic-time";
import { RequestBodyError, readFormDataBody, readJsonBody } from "../src/lib/request-body";
import { isTrustedMutationRequest, rejectUntrustedMutation } from "../src/lib/request-security";
import { applyStockQuantityChange } from "../src/lib/services/stockService";
import { paymentSchema } from "../src/lib/validations/finance";
import { patientSchema } from "../src/lib/validations/patient";
import { secureHttpsUrlSchema } from "../src/lib/validations/common";
import { doctorSchema } from "../src/lib/validations/staff";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("browser mutation guard rejects cross-site requests while native requests without Origin remain supported", async () => {
  const crossSite = new Request("https://clinic.example/api/mobile/sync", {
    method: "POST",
    headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" }
  });
  assert.equal(isTrustedMutationRequest(crossSite), false);
  assert.equal(rejectUntrustedMutation(crossSite)?.status, 403);

  const native = new Request("https://clinic.example/api/mobile/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}"
  });
  assert.equal(isTrustedMutationRequest(native), true);
  assert.equal(rejectUntrustedMutation(native), null);
});

test("bounded request readers enforce declared and streamed limits", async () => {
  await assert.rejects(
    readJsonBody(new Request("https://clinic.example/api", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "999" },
      body: "{}"
    }), 32),
    (error: unknown) => error instanceof RequestBodyError && error.status === 413
  );
  await assert.rejects(
    readJsonBody(new Request("https://clinic.example/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(100) })
    }), 32),
    (error: unknown) => error instanceof RequestBodyError && error.status === 413
  );
  assert.deepEqual(
    await readJsonBody(new Request("https://clinic.example/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true })
    }), 64),
    { ok: true }
  );

  const form = new FormData();
  form.set("note", "güvenli");
  const parsed = await readFormDataBody(new Request("https://clinic.example/upload", { method: "POST", body: form }), 4096);
  assert.equal(parsed.get("note"), "güvenli");
});

test("API input schemas reject oversized clinical fields and invalid calendar dates", () => {
  const patient = { firstName: "Ayşe", lastName: "Yılmaz", phone: "5551234567", gender: "UNSPECIFIED", tag: "ACTIVE" };
  assert.equal(patientSchema.safeParse({ ...patient, notes: "x".repeat(4001) }).success, false);
  assert.equal(patientSchema.safeParse({ ...patient, birthDate: "2026-02-30" }).success, false);
  assert.equal(patientSchema.safeParse({ ...patient, birthDate: "1899-12-31" }).success, false);
  assert.equal(patientSchema.safeParse({ ...patient, birthDate: "2999-01-01" }).success, false);
  const payment = { type: "INCOME", amount: 100, method: "CARD", status: "PAID" };
  assert.equal(paymentSchema.safeParse({ ...payment, dueDate: "2026-02-30" }).success, false);
  assert.equal(paymentSchema.safeParse({ ...payment, amount: 100_000_001 }).success, false);
});

test("doctor and purchase URL inputs are bounded and reject credential-bearing URLs", () => {
  assert.equal(doctorSchema.safeParse({ name: "Dr. Ayşe", email: "AYSE@EXAMPLE.TEST", branchId: "branch-1" }).success, true);
  assert.equal(doctorSchema.safeParse({ name: "x".repeat(161), email: "ayse@example.test", branchId: "branch-1" }).success, false);
  assert.equal(secureHttpsUrlSchema.safeParse("https://shop.example/urun").success, true);
  assert.equal(secureHttpsUrlSchema.safeParse("https://user:secret@shop.example/urun").success, false);
  assert.equal(secureHttpsUrlSchema.safeParse("https://shop.example:8443/urun").success, false);
  assert.equal(secureHttpsUrlSchema.safeParse(`https://shop.example/${"x".repeat(2048)}`).success, false);
});

test("a due date becomes overdue only after its Istanbul calendar day", () => {
  const due = new Date("2026-07-20T09:00:00.000Z");
  assert.equal(isClinicDateOverdue(due, new Date("2026-07-20T20:30:00.000Z")), false);
  assert.equal(isClinicDateOverdue(due, new Date("2026-07-20T21:00:00.000Z")), true);
});

test("stock exits use a conditional decrement instead of a read-modify-write update", async () => {
  let updateWhere: unknown;
  let updateData: unknown;
  const database = {
    stockItem: {
      findFirst: async () => ({ id: "item-1", organizationId: "org-1", branchId: "branch-1", currentQuantity: 5 }),
      updateMany: async ({ where, data }: { where: unknown; data: unknown }) => {
        updateWhere = where;
        updateData = data;
        return { count: 1 };
      },
      update: async () => { throw new Error("OUT must not use an unconditional update"); }
    }
  };
  await applyStockQuantityChange(database as never, {
    organizationId: "org-1",
    branchId: "branch-1",
    itemId: "item-1",
    type: StockMovementType.OUT,
    quantity: 3
  });
  assert.deepEqual(updateWhere, { id: "item-1", organizationId: "org-1", deletedAt: null, branchId: "branch-1", currentQuantity: { gte: 3 } });
  assert.deepEqual(updateData, { currentQuantity: { decrement: 3 } });
});

test("mobile runtime password hashing no longer imports the server-only auth module", () => {
  const mobileSync = source("src/lib/services/mobileSyncService.ts");
  assert.match(mobileSync, /import \{ hashPassword \} from "@\/lib\/password"/);
  assert.doesNotMatch(mobileSync, /import \{ hashPassword \} from "@\/lib\/auth"/);
  assert.doesNotMatch(source("src/lib/password.ts"), /server-only/);
});

test("active operational dashboards and mobile snapshots filter soft-deleted patient relations", () => {
  const reports = source("src/lib/services/reportService.ts");
  const mobile = source("src/lib/services/mobileSyncService.ts");
  assert.match(reports, /startsAt: \{ gte: todayStart, lt: tomorrowStart \}, patient: \{ deletedAt: null \}/);
  assert.match(reports, /channel: CommunicationChannel\.PHONE[\s\S]*patient: \{ deletedAt: null \}/);
  assert.match(reports, /status: \{ in: \[RecallStatus\.OPEN, RecallStatus\.CONTACTED\] \}, patient: \{ deletedAt: null \}/);
  assert.match(mobile, /"appointments"\) \? prisma\.appointment\.findMany\(\{\s*where: \{ organizationId, \.\.\.branch, patient: \{ deletedAt: null \} \}/);
  assert.match(mobile, /"finance"\) \? prisma\.payment\.findMany\(\{\s*where: \{ organizationId, \.\.\.branch, OR: \[\{ patientId: null \}, \{ patient: \{ deletedAt: null \} \}]/);
});

test("login and portal throttles do not expose secrets or depend only on spoofable client IPs", () => {
  const login = source("src/app/api/auth/login/route.ts");
  const portalLogin = source("src/app/portal/login/page.tsx");
  assert.doesNotMatch(login, /NextResponse\.json\(\{ user: session \}\)/);
  assert.match(login, /userId: session\.userId/);
  assert.match(login, /Cache-Control": "private, no-store/);
  assert.match(login, /auth:login-account:/);
  assert.match(portalLogin, /portal-login-account:/);
  assert.match(portalLogin, /createHash\("sha256"\)/);
});

test("doctor mutations cannot convert clinic owners or other staff roles", () => {
  const doctorsPage = source("src/app/dashboard/doctors/page.tsx");
  const mobileSync = source("src/lib/services/mobileSyncService.ts");
  assert.match(doctorsPage, /existing\.role !== Role\.DOCTOR/);
  assert.doesNotMatch(doctorsPage, /data: \{ name, role: Role\.DOCTOR/);
  assert.match(mobileSync, /duplicate\.role !== Role\.DOCTOR/);
  assert.match(mobileSync, /existingDoctor\.role !== Role\.DOCTOR/);
  assert.match(mobileSync, /readOnly: doctor\.role !== Role\.DOCTOR/);
});

test("mobile communication values are represented by the Prisma schema", () => {
  const mobileSync = source("src/lib/services/mobileSyncService.ts");
  const prismaSchema = source("prisma/schema.prisma");
  assert.match(mobileSync, /z\.enum\(\["WHATSAPP", "SMS", "EMAIL", "PHONE", "IN_APP"\]\)/);
  assert.match(mobileSync, /z\.enum\(\["QUEUED", "SENT", "DELIVERED", "FAILED"\]\)/);
  assert.match(prismaSchema, /enum CommunicationChannel \{[\s\S]*IN_APP[\s\S]*\}/);
  assert.match(prismaSchema, /enum CommunicationStatus \{[\s\S]*DELIVERED[\s\S]*\}/);
});

test("mobile date-only clinical values use the Istanbul parser instead of host timezone", () => {
  const mobileSync = source("src/lib/services/mobileSyncService.ts");
  assert.match(mobileSync, /birthDate: payload\.birthDate \? parseClinicDateTime\(`/);
  assert.match(mobileSync, /plannedAt: parseClinicDateTime\(`/);
  assert.match(mobileSync, /performedAt: parseClinicDateTime\(`/);
  assert.match(mobileSync, /dueDate: payload\.dueDate \? parseClinicDateTime\(`/);
  assert.doesNotMatch(mobileSync, /operation\.entityType === "RECALL"/);
  assert.doesNotMatch(mobileSync, /new Date\(`\$\{payload\.(?:birthDate|date|dueDate)\}T12:00:00`\)/);
});

test("clinical status changes, portal cancellation and chair edits use serializable compare-and-set writes", () => {
  const statusService = source("src/lib/services/treatmentStockService.ts");
  const mobileSync = source("src/lib/services/mobileSyncService.ts");
  const portal = source("src/lib/services/portalService.ts");
  const settings = source("src/app/dashboard/settings/page.tsx");
  assert.match(statusService, /withSerializableTransaction/);
  assert.match(statusService, /status: treatment\.status/);
  assert.match(statusService, /status: appointment\.status/);
  assert.match(mobileSync, /operation\.entityType === "APPOINTMENT" \|\| operation\.entityType === "TREATMENT"/);
  assert.match(portal, /withSerializableAppointmentTransaction/);
  assert.match(portal, /status: \{ in: cancellableStatuses \}/);
  assert.match(portal, /patient: \{ deletedAt: null \}/);
  assert.match(settings, /withSerializableTransaction/);
  assert.match(settings, /normalizeChairName/);
});

test("treatment forms enforce patient-branch doctor eligibility on the server and in their options", () => {
  for (const path of ["src/app/dashboard/treatments/page.tsx", "src/app/dashboard/treatment-plans/page.tsx"]) {
    const page = source(path);
    assert.match(page, /OR: \[\{ branchId: patient\.branchId \}, \{ branchId: null \}\]/);
    assert.match(page, /active: true/);
    assert.match(page, /<PatientDoctorFields patients=\{patients\} doctors=\{doctors\}/);
  }
  const fields = source("src/components/dashboard/patient-doctor-fields.tsx");
  assert.match(fields, /doctor\.branchId === null \|\| doctor\.branchId === patientBranchId/);
});
