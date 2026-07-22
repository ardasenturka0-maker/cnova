import assert from "node:assert/strict";
import test from "node:test";
import { createMfaSecret, createRecoveryCodes, decryptMfaSecret, encryptMfaSecret, hashRecoveryCode, totpCode, verifyTotp } from "../src/lib/mfa";

test("TOTP accepts the current window, rejects invalid values and exposes its counter", () => {
  const secret = createMfaSecret();
  const now = 1_750_000_000_000;
  const counter = Math.floor(now / 1000 / 30);
  const code = totpCode(secret, counter);
  assert.equal(verifyTotp(secret, code, now), counter);
  assert.equal(verifyTotp(secret, "00000x", now), null);
  assert.equal(verifyTotp(secret, code, now + 120_000), null);
});

test("MFA secrets use authenticated encryption and fail with the wrong key", () => {
  try {
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 31).toString("base64");
    const encrypted = encryptMfaSecret("JBSWY3DPEHPK3PXP");
    assert.equal(decryptMfaSecret(encrypted), "JBSWY3DPEHPK3PXP");
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 32).toString("base64");
    assert.throws(() => decryptMfaSecret(encrypted));
  } finally { delete process.env.MFA_ENCRYPTION_KEY; }
});

test("recovery codes are unique and stored as irreversible hashes", () => {
  const codes = createRecoveryCodes();
  assert.equal(new Set(codes).size, 8);
  assert.ok(codes.every((code) => /^[A-F0-9]{6}-[A-F0-9]{6}$/.test(code)));
  assert.notEqual(hashRecoveryCode(codes[0]), codes[0]);
  assert.equal(hashRecoveryCode(codes[0].toLowerCase()), hashRecoveryCode(codes[0]));
});
