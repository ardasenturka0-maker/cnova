import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop renderer is sandboxed and native bridges are limited to packaged content", async () => {
  const [main, preload] = await Promise.all([
    readFile("desktop/main.cjs", "utf8"),
    readFile("desktop/preload.cjs", "utf8")
  ]);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /safeStorage\.encryptString/);
  assert.match(main, /event\.senderFrame\.url/);
  assert.match(main, /clinicnova:\/\/app/);
  assert.match(preload, /window\.location\.protocol === "clinicnova:"/);
  assert.doesNotMatch(preload, /send:\s*ipcRenderer\.send/);
});

test("desktop local records use the OS-encrypted native store when available", async () => {
  const mobile = await readFile("mobile/assets/app.js", "utf8");
  assert.match(mobile, /ClinicNovaNative\?\.storage\?\.getItem/);
  assert.match(mobile, /ClinicNovaNative\.storage\.setItem/);
  assert.match(mobile, /ClinicNovaNative\?\.onSyncResult/);
});

test("local-first clients push pending changes and pull a server snapshot", async () => {
  const [mobile, route] = await Promise.all([
    readFile("mobile/assets/app.js", "utf8"),
    readFile("src/app/api/mobile/sync/route.ts", "utf8")
  ]);
  assert.match(mobile, /function applyServerSnapshot\(snapshot\)/);
  assert.match(mobile, /operations = syncQueue\.filter\(\(item\) => canSyncEntity\(item\.entityType\)\)\.slice\(0, 50\)/);
  assert.match(mobile, /applyServerSnapshot\(response\.snapshot\)/);
  assert.match(route, /getMobileSnapshot\(session, batch\.deviceId\)/);
});

test("offline clinic login stores only a derived password and supports Android native PBKDF2", async () => {
  const [mobile, android] = await Promise.all([
    readFile("mobile/assets/app.js", "utf8"),
    readFile("mobile/src/app/clinicnova/mobile/MainActivity.java", "utf8")
  ]);
  assert.match(mobile, /PBKDF2/);
  assert.match(mobile, /passwordHash/);
  assert.match(mobile, /recoveryHash/);
  assert.match(mobile, /failures >= 5/);
  assert.doesNotMatch(mobile, /localAccount[^\n]*password:/);
  assert.match(android, /PBKDF2WithHmacSHA256/);
  assert.match(android, /spec\.clearPassword\(\)/);
});

test("Android authenticates in its own cookie jar and removes native bridges from remote pages", async () => {
  const [mobile, android] = await Promise.all([
    readFile("mobile/assets/app.js", "utf8"),
    readFile("mobile/src/app/clinicnova/mobile/MainActivity.java", "utf8")
  ]);
  assert.match(mobile, /ClinicNovaNative\?\.connect/);
  assert.match(mobile, /ClinicNovaNative\?\.openPortal/);
  assert.match(android, /validatedServerUrl/);
  assert.match(android, /trustedOrigin\.equals\(originOf\(uri\)\)/);
  assert.match(android, /removeJavascriptInterface\("ClinicNovaNative"\)/);
  assert.match(android, /setAcceptThirdPartyCookies\(webView, false\)/);
  assert.match(android, /MIXED_CONTENT_NEVER_ALLOW/);
});
