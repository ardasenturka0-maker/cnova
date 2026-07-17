import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync("mobile/assets/app.js", "utf8");
const ios = fs.readFileSync("ios/ClinicNova/ViewController.swift", "utf8");
const android = fs.readFileSync("mobile/src/app/clinicnova/mobile/MainActivity.java", "utf8");

test("appointment reminders are clinic-controlled and idempotent", () => {
  assert.match(app, /weekEnabled \? 7/);
  assert.match(app, /dayEnabled \? 1/);
  assert.match(app, /senderDeviceId !== deviceId/);
  assert.match(app, /"Idempotency-Key": deliveryId/);
  assert.match(app, /previous\?\.status === "SENT"/);
  assert.match(app, /reminderSettingsForm/);
  assert.match(app, /Otomatik gönderimi aç/);
});

test("completed treatments carry compressed before and after photos in the mesh document", () => {
  assert.match(app, /name="beforePhoto"/);
  assert.match(app, /name="afterPhoto"/);
  assert.match(app, /record\.beforePhoto, record\.afterPhoto/);
  assert.match(app, /canvas\.toDataURL\("image\/jpeg"/);
  assert.match(app, /treatments, staffRecords/);
});

test("Android and iOS local records use their hardware-backed encrypted stores", () => {
  assert.match(android, /storageGet\(String key\).*meshRead/);
  assert.match(android, /AndroidKeyStore/);
  assert.match(ios, /storageGet:/);
  assert.match(ios, /store\.write\("records"/);
  assert.match(fs.readFileSync("ios/ClinicNova/SecureMeshStore.swift", "utf8"), /AES\.GCM\.seal/);
});
