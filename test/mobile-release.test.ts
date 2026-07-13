import assert from "node:assert/strict";
import test from "node:test";
import { compareVersions, getMobileRelease } from "../src/lib/mobile-release";

test("mobile versions compare numerically instead of lexically", () => {
  assert.equal(compareVersions("1.10.0", "1.9.9"), 1);
  assert.equal(compareVersions("1.2.0", "1.2.0"), 0);
  assert.throws(() => compareVersions("1.2", "1.2.0"));
});

test("mobile release rejects insecure URLs, malformed checksums and impossible minimums", () => {
  const original = { min: process.env.MOBILE_MIN_VERSION, url: process.env.MOBILE_APK_URL, sha: process.env.MOBILE_APK_SHA256 };
  try {
    process.env.MOBILE_MIN_VERSION = "1.2.0";
    process.env.MOBILE_APK_URL = "http://download.example.test/app.apk";
    process.env.MOBILE_APK_SHA256 = "a".repeat(64);
    assert.throws(() => getMobileRelease(), /HTTPS/);
    process.env.MOBILE_APK_URL = "https://download.example.test/app.apk";
    process.env.MOBILE_APK_SHA256 = "broken";
    assert.throws(() => getMobileRelease(), /SHA-256/);
    process.env.MOBILE_APK_SHA256 = "b".repeat(64);
    process.env.MOBILE_MIN_VERSION = "9.0.0";
    assert.throws(() => getMobileRelease(), /büyük/);
  } finally {
    if (original.min === undefined) delete process.env.MOBILE_MIN_VERSION; else process.env.MOBILE_MIN_VERSION = original.min;
    if (original.url === undefined) delete process.env.MOBILE_APK_URL; else process.env.MOBILE_APK_URL = original.url;
    if (original.sha === undefined) delete process.env.MOBILE_APK_SHA256; else process.env.MOBILE_APK_SHA256 = original.sha;
  }
});
