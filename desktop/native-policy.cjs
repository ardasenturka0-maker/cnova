const crypto = require("node:crypto");

const MAX_SERVER_URL_BYTES = 2048;
const MAX_PRODUCT_URL_BYTES = 8192;
const MAX_SYNC_BATCH_BYTES = 4 * 1024 * 1024;
const MAX_SYNC_OPERATIONS = 50;

function byteLengthWithin(value, maximum) {
  return typeof value === "string" && Buffer.byteLength(value, "utf8") <= maximum;
}

function validStorageKey(key) {
  return typeof key === "string" && /^clinicnova\.[A-Za-z0-9._-]{1,80}$/.test(key);
}

function isLocalAppDocument(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "clinicnova:" && parsed.hostname === "app" &&
      !parsed.username && !parsed.password && !parsed.port && ["", "/", "/index.html"].includes(parsed.pathname);
  } catch { return false; }
}

function sanitizeEncryptedStore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = Object.create(null);
  for (const [key, encryptedValue] of Object.entries(value)) {
    if (validStorageKey(key) && typeof encryptedValue === "string") result[key] = encryptedValue;
  }
  return result;
}

function normalizeServerOrigin(value) {
  if (!byteLengthWithin(value, MAX_SERVER_URL_BYTES)) throw new Error("HTTPS sunucu adresi gerekli.");
  let parsed;
  try { parsed = new URL(value.trim()); } catch { throw new Error("HTTPS sunucu adresi gerekli."); }
  if (
    parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password ||
    (parsed.port && parsed.port !== "443") || !["", "/"].includes(parsed.pathname) || parsed.search || parsed.hash
  ) throw new Error("HTTPS sunucu adresi gerekli.");
  return parsed.origin;
}

function normalizeProductUrl(value) {
  if (!byteLengthWithin(value, MAX_PRODUCT_URL_BYTES)) throw new Error("HTTPS satın alma sayfası gerekli.");
  let parsed;
  try { parsed = new URL(value.trim()); } catch { throw new Error("HTTPS satın alma sayfası gerekli."); }
  if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) throw new Error("HTTPS satın alma sayfası gerekli.");
  return parsed.href;
}

function normalizeDashboardPath(value) {
  const path = typeof value === "string" ? value : "";
  if (!/^\/dashboard(?:\/[A-Za-z0-9_-]+)*\/?$/.test(path) || Buffer.byteLength(path, "utf8") > 512) return "/dashboard";
  return path;
}

function classifyMainFrameRedirect(targetValue, allowedOrigin, currentValue, hasPendingNavigation) {
  let target;
  try { target = new URL(targetValue); } catch { return "block"; }
  if (
    target.protocol === "clinicnova:" && target.hostname === "sync" &&
    !target.username && !target.password && ["", "/"].includes(target.pathname) && !target.search && !target.hash
  ) return "local-sync";
  let currentOrigin = "";
  try { currentOrigin = new URL(currentValue).origin; } catch { /* An empty/uncommitted page has no trusted origin. */ }
  if (
    target.protocol === "https:" && !target.username && !target.password &&
    typeof allowedOrigin === "string" && allowedOrigin.startsWith("https://") &&
    target.origin === allowedOrigin && (Boolean(hasPendingNavigation) || currentOrigin === allowedOrigin)
  ) return "allow-server";
  return "block";
}

function parseSyncBatch(batchJson) {
  if (!byteLengthWithin(batchJson, MAX_SYNC_BATCH_BYTES)) throw new Error("Senkronizasyon paketi çok büyük.");
  let parsed;
  try { parsed = JSON.parse(batchJson); } catch { throw new Error("Senkronizasyon paketi geçersiz."); }
  if (
    !parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
    !/^[A-Za-z0-9._:-]{8,128}$/.test(String(parsed.deviceId || "")) ||
    !Array.isArray(parsed.operations) || parsed.operations.length > MAX_SYNC_OPERATIONS ||
    parsed.operations.some((operation) => !operation || typeof operation !== "object" || Array.isArray(operation))
  ) throw new Error("Senkronizasyon paketi geçersiz.");
  return parsed;
}

function hashSecret(secret, saltBase64, iterations) {
  if (
    !byteLengthWithin(secret, 4096) || typeof saltBase64 !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(saltBase64) ||
    !Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000
  ) return "";
  const salt = Buffer.from(saltBase64, "base64");
  if (salt.length < 8 || salt.length > 64) return "";
  try { return crypto.pbkdf2Sync(secret, salt, iterations, 32, "sha256").toString("base64"); } catch { return ""; }
}

module.exports = {
  MAX_PRODUCT_URL_BYTES,
  MAX_SERVER_URL_BYTES,
  MAX_SYNC_BATCH_BYTES,
  MAX_SYNC_OPERATIONS,
  classifyMainFrameRedirect,
  hashSecret,
  isLocalAppDocument,
  normalizeDashboardPath,
  normalizeProductUrl,
  normalizeServerOrigin,
  parseSyncBatch,
  sanitizeEncryptedStore,
  validStorageKey
};
