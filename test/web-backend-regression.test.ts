import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { clinicDateKey, clinicDayRange, parseClinicDateTime } from "../src/lib/clinic-time";
import { assertAppointmentAvailability } from "../src/lib/services/appointmentService";
import { digitalConsentSignSchema } from "../src/lib/validations/digital-consent";
import { portalAppointmentSchema } from "../src/lib/validations/portal";

const appointmentService = readFileSync(new URL("../src/lib/services/appointmentService.ts", import.meta.url), "utf8");
const appointmentAvailability = readFileSync(new URL("../src/lib/services/appointmentAvailability.ts", import.meta.url), "utf8");
const portalService = readFileSync(new URL("../src/lib/services/portalService.ts", import.meta.url), "utf8");
const authService = readFileSync(new URL("../src/lib/auth.ts", import.meta.url), "utf8");
const patientFileRoute = readFileSync(new URL("../src/app/api/patients/[id]/files/[fileId]/route.ts", import.meta.url), "utf8");
const standaloneStart = readFileSync(new URL("../scripts/start-standalone.mjs", import.meta.url), "utf8");
const packageInfo = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { scripts: Record<string, string> };

test("clinic-local appointment values are parsed as Istanbul time independently from host TZ", () => {
  assert.equal(parseClinicDateTime("2026-07-20T10:30")?.toISOString(), "2026-07-20T07:30:00.000Z");
  assert.equal(parseClinicDateTime("2026-02-30T10:30"), null);
  assert.equal(parseClinicDateTime("2026-07-20T10:30:00Z")?.toISOString(), "2026-07-20T10:30:00.000Z");
  assert.equal(parseClinicDateTime("2026-07-20 10:30"), null);
});

test("clinic day boundaries remain Istanbul-based near UTC midnight", () => {
  assert.equal(clinicDateKey(new Date("2026-07-19T21:00:00.000Z")), "2026-07-20");
  assert.equal(clinicDateKey(new Date("2026-07-19T20:59:59.999Z")), "2026-07-19");
  const range = clinicDayRange("2026-07-20");
  assert.equal(range.from.toISOString(), "2026-07-19T21:00:00.000Z");
  assert.equal(range.to.toISOString(), "2026-07-20T21:00:00.000Z");
});

test("portal appointments reject malformed dates, times and oversized notes", () => {
  const valid = { doctorId: "doctor-1", date: "2026-07-20", time: "09:30", treatmentType: "Kontrol", notes: "" };
  assert.equal(portalAppointmentSchema.safeParse(valid).success, true);
  assert.equal(portalAppointmentSchema.safeParse({ ...valid, date: "2026-02-30" }).success, false);
  assert.equal(portalAppointmentSchema.safeParse({ ...valid, time: "25:00" }).success, false);
  assert.equal(portalAppointmentSchema.safeParse({ ...valid, notes: "x".repeat(4001) }).success, false);
});

test("digital consent requires a real checked value instead of truthy text coercion", () => {
  const base = { token: "t".repeat(40), signerName: "Ayşe Yılmaz", signatureData: "Ayşe Yılmaz" };
  assert.equal(digitalConsentSignSchema.safeParse({ ...base, understood: "true" }).success, true);
  assert.equal(digitalConsentSignSchema.safeParse({ ...base, understood: "false" }).success, false);
  assert.equal(digitalConsentSignSchema.safeParse(base).success, false);
});

test("appointment writes use serializable transactions and protect doctor and chair resources", () => {
  assert.match(appointmentAvailability, /TransactionIsolationLevel\.Serializable/);
  assert.match(appointmentAvailability, /branchId: input\.branchId, room: \{ equals: room, mode: "insensitive" \}/);
  assert.match(appointmentService, /OR: \[\{ branchId: patient\.branchId \}, \{ branchId: null \}\]/);
  assert.match(portalService, /return createAppointment\(session\.organizationId/);
  assert.match(portalService, /excludeAppointmentId: appointment\.id/);
});

test("appointment conflicts are detected for doctors across branches and rooms within a branch", async () => {
  const startsAt = new Date("2026-07-20T07:00:00.000Z");
  const input = { organizationId: "org-1", branchId: "branch-1", doctorId: "doctor-1", startsAt, durationMinutes: 30, room: "Koltuk 1" };
  const databaseWith = (candidate: { branchId: string; doctorId: string; room: string | null; startsAt: Date; durationMinutes: number }) => ({
    appointment: { findMany: async () => [candidate] }
  }) as never;

  await assert.rejects(
    assertAppointmentAvailability(databaseWith({ ...input, branchId: "branch-2", room: null }), input),
    /doktorun/
  );
  await assert.rejects(
    assertAppointmentAvailability(databaseWith({ ...input, doctorId: "doctor-2", room: "koltuk 1" }), input),
    /oda veya koltuk/
  );
  await assert.doesNotReject(
    assertAppointmentAvailability(databaseWith({ ...input, branchId: "branch-2", doctorId: "doctor-2", room: "Koltuk 1" }), input)
  );
});

test("staff sessions are revalidated and password changes revoke old JWTs", () => {
  assert.match(authService, /active: true/);
  assert.match(authService, /credentialVersion\(user\.passwordHash\) !== session\.credentialVersion/);
});

test("patient clinical files are never browser-cached after access", () => {
  assert.match(patientFileRoute, /patient: \{ deletedAt: null \}/);
  assert.match(patientFileRoute, /private, no-store, max-age=0/);
});

test("production start uses the generated standalone server", () => {
  assert.equal(packageInfo.scripts.start, "node scripts/start-standalone.mjs");
  assert.equal(packageInfo.scripts["start:production"], "npm run production:check && npm run prisma:deploy && npm run start");
  assert.match(standaloneStart, /name === "--hostname"/);
  assert.match(standaloneStart, /name === "--port"/);
  assert.match(standaloneStart, /process\.env\.HOSTNAME = serverArguments\.hostname/);
  assert.match(standaloneStart, /process\.env\.PORT = serverArguments\.port/);
});
