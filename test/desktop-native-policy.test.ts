import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  classifyMainFrameRedirect,
  hashSecret,
  isLocalAppDocument,
  normalizeDashboardPath,
  normalizeProductUrl,
  normalizeServerOrigin,
  parseSyncBatch,
  sanitizeEncryptedStore,
  validStorageKey
} = require("../desktop/native-policy.cjs");

test("desktop local document recognition does not depend on the WHATWG custom-scheme origin", () => {
  assert.equal(new URL("clinicnova://app/index.html").origin, "null");
  assert.equal(isLocalAppDocument("clinicnova://app/index.html?sync=1"), true);
  assert.equal(isLocalAppDocument("clinicnova://app/"), true);
  assert.equal(isLocalAppDocument("clinicnova://app/app.js"), false);
  assert.equal(isLocalAppDocument("clinicnova://sync"), false);
  assert.equal(isLocalAppDocument("https://app/index.html"), false);
});

test("desktop server redirects stay on the pinned HTTPS origin or return through the sync scheme", () => {
  const origin = "https://clinic.example";
  assert.equal(classifyMainFrameRedirect("https://clinic.example/mobile-connect", origin, "clinicnova://app/index.html", true), "allow-server");
  assert.equal(classifyMainFrameRedirect("https://clinic.example/dashboard", origin, "https://clinic.example/login", false), "allow-server");
  assert.equal(classifyMainFrameRedirect("clinicnova://sync", origin, "https://clinic.example/mobile-connect", false), "local-sync");
  assert.equal(classifyMainFrameRedirect("clinicnova://sync/extra", origin, "https://clinic.example/mobile-connect", false), "block");
  assert.equal(classifyMainFrameRedirect("clinicnova://sync?next=https://evil.example", origin, "https://clinic.example/mobile-connect", false), "block");
  assert.equal(classifyMainFrameRedirect("https://evil.example/steal", origin, "https://clinic.example/login", true), "block");
  assert.equal(classifyMainFrameRedirect("http://clinic.example/mobile-connect", origin, "https://clinic.example/login", true), "block");
  assert.equal(classifyMainFrameRedirect("https://user:pass@clinic.example/mobile-connect", origin, "https://clinic.example/login", true), "block");
  assert.equal(classifyMainFrameRedirect("clinicnova://app/index.html", origin, "https://clinic.example/login", true), "block");
});

test("desktop native policy pins API traffic to a bare HTTPS origin", () => {
  assert.equal(normalizeServerOrigin(" https://Clinic.Example:443/ "), "https://clinic.example");
  for (const value of [
    "http://clinic.example",
    "https://user:secret@clinic.example",
    "https://clinic.example:8443",
    "https://clinic.example/api",
    "https://clinic.example/?tenant=other",
    "https://clinic.example/#login"
  ]) assert.throws(() => normalizeServerOrigin(value), /HTTPS/);
});

test("desktop product and portal destinations reject credential and traversal tricks", () => {
  assert.equal(normalizeProductUrl("https://shop.example/item?id=3"), "https://shop.example/item?id=3");
  assert.throws(() => normalizeProductUrl("http://shop.example/item"), /HTTPS/);
  assert.throws(() => normalizeProductUrl("https://user:pass@shop.example/item"), /HTTPS/);
  assert.equal(normalizeDashboardPath("/dashboard/stocks"), "/dashboard/stocks");
  assert.equal(normalizeDashboardPath("/dashboard/../admin"), "/dashboard");
  assert.equal(normalizeDashboardPath("//evil.example/dashboard"), "/dashboard");
});

test("desktop sync batches are bounded and structurally validated before native fetch", () => {
  const batch = JSON.stringify({ deviceId: "device-12345678", operations: [{ operationId: "one" }] });
  assert.equal(parseSyncBatch(batch).operations.length, 1);
  assert.throws(() => parseSyncBatch(JSON.stringify({ deviceId: "short", operations: [] })), /geçersiz/);
  assert.throws(() => parseSyncBatch(JSON.stringify({ deviceId: "device-12345678", operations: Array.from({ length: 51 }, () => ({})) })), /geçersiz/);
  assert.throws(() => parseSyncBatch(JSON.stringify({ deviceId: "device-12345678", operations: [null] })), /geçersiz/);
});

test("desktop PBKDF2 fallback matches the browser and native mobile contract", () => {
  const salt = Buffer.alloc(16, 9);
  const expected = crypto.pbkdf2Sync("correct horse battery staple", salt, 210000, 32, "sha256").toString("base64");
  assert.equal(hashSecret("correct horse battery staple", salt.toString("base64"), 210000), expected);
  assert.equal(hashSecret("password", "not base64", 210000), "");
  assert.equal(hashSecret("password", salt.toString("base64"), 99999), "");
});

test("desktop encrypted store ignores corrupted shapes and untrusted keys", () => {
  assert.equal(validStorageKey("clinicnova.localAccount"), true);
  assert.equal(validStorageKey("__proto__"), false);
  assert.deepEqual(Object.keys(sanitizeEncryptedStore(null)), []);
  assert.deepEqual(Object.keys(sanitizeEncryptedStore(["bad"])), []);
  assert.deepEqual(Object.keys(sanitizeEncryptedStore({ "clinicnova.good": "ciphertext", bad: "value", "clinicnova.object": {} })), ["clinicnova.good"]);
});
