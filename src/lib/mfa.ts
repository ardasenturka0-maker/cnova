import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAuthSecret } from "@/lib/auth-config";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const stepSeconds = 30;

function encodeBase32(input: Buffer) {
  let bits = "";
  for (const byte of input) bits += byte.toString(2).padStart(8, "0");
  let result = "";
  for (let index = 0; index < bits.length; index += 5) {
    result += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return result;
}

function decodeBase32(input: string) {
  const normalized = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of normalized) {
    const value = alphabet.indexOf(character);
    if (value < 0) throw new Error("Geçersiz MFA anahtarı.");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

function legacyMfaKey() {
  const encoded = process.env.MFA_ENCRYPTION_KEY;
  if (encoded) {
    const key = Buffer.from(encoded, "base64");
    if (key.length === 32) return key;
  }
  if (process.env.NODE_ENV === "production") throw new Error("MFA_ENCRYPTION_KEY 32 bayt base64 olmalıdır.");
  return createHmac("sha256", "clinicnova-mfa-development").update(getAuthSecret()).digest();
}

function mfaKeyring() {
  const configured = process.env.MFA_ENCRYPTION_KEYS;
  if (!configured) return { activeId: "legacy", keys: new Map([["legacy", legacyMfaKey()]]) };
  let values: Record<string, unknown>;
  try { values = JSON.parse(configured) as Record<string, unknown>; } catch { throw new Error("MFA_ENCRYPTION_KEYS geçerli JSON olmalıdır."); }
  const keys = new Map<string, Buffer>();
  for (const [id, encoded] of Object.entries(values)) {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(id) || typeof encoded !== "string") throw new Error("MFA anahtar kimliği geçersiz.");
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32) throw new Error(`${id} MFA anahtarı 32 bayt base64 olmalıdır.`);
    keys.set(id, key);
  }
  const activeId = process.env.MFA_ENCRYPTION_ACTIVE_KEY_ID ?? "";
  if (!keys.has(activeId)) throw new Error("MFA_ENCRYPTION_ACTIVE_KEY_ID anahtar halkasında bulunamadı.");
  return { activeId, keys };
}

export function createMfaSecret() {
  return encodeBase32(randomBytes(20));
}

export function encryptMfaSecret(secret: string) {
  const { activeId, keys } = mfaKeyring();
  const keyId = Buffer.from(activeId, "utf8");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys.get(activeId)!, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from("MFA2"), Buffer.from([keyId.length]), keyId, iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptMfaSecret(value: string) {
  const payload = Buffer.from(value, "base64");
  let key: Buffer; let iv: Buffer; let tag: Buffer; let encrypted: Buffer;
  if (payload.subarray(0, 4).toString() === "MFA1") {
    if (payload.length < 33) throw new Error("MFA anahtarı okunamadı.");
    key = legacyMfaKey(); iv = payload.subarray(4, 16); tag = payload.subarray(16, 32); encrypted = payload.subarray(32);
  } else if (payload.subarray(0, 4).toString() === "MFA2") {
    const keyIdLength = payload[4]; const offset = 5 + keyIdLength;
    if (!keyIdLength || payload.length < offset + 29) throw new Error("MFA anahtarı okunamadı.");
    const found = mfaKeyring().keys.get(payload.subarray(5, offset).toString("utf8"));
    if (!found) throw new Error("MFA şifreleme anahtarı kasada bulunamadı.");
    key = found; iv = payload.subarray(offset, offset + 12); tag = payload.subarray(offset + 12, offset + 28); encrypted = payload.subarray(offset + 28);
  } else throw new Error("MFA anahtarı okunamadı.");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function reencryptMfaSecret(value: string) { return encryptMfaSecret(decryptMfaSecret(value)); }

export function totpCode(secret: string, counter = Math.floor(Date.now() / 1000 / stepSeconds)) {
  const moving = Buffer.alloc(8);
  moving.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(moving).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, "0");
}

export function verifyTotp(secret: string, code: string, now = Date.now()) {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const current = Math.floor(now / 1000 / stepSeconds);
  for (const counter of [current - 1, current, current + 1]) {
    const expected = Buffer.from(totpCode(secret, counter));
    const actual = Buffer.from(normalized);
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) return counter;
  }
  return null;
}

export function buildOtpauthUri(secret: string, email: string, organizationName: string) {
  const issuer = "ClinicNova";
  const label = encodeURIComponent(`${issuer}:${organizationName} - ${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${stepSeconds}`;
}

export function createRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const value = randomBytes(7).toString("hex").toUpperCase().slice(0, 12);
    return `${value.slice(0, 6)}-${value.slice(6)}`;
  });
}

export function hashRecoveryCode(code: string) {
  return createHmac("sha256", getAuthSecret()).update(code.toUpperCase().replace(/[^A-Z0-9]/g, "")).digest("hex");
}
