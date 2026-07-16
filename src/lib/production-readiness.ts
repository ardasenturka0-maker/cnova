import { isMobileReleaseReady } from "@/lib/mobile-release";

export type ReadinessState = "pass" | "warning" | "error";

export type ReadinessCheck = {
  key: string;
  label: string;
  state: ReadinessState;
  detail: string;
};

function isHttpsUrl(value: string | undefined) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isStrongSecret(value: string | undefined, minimum = 32) {
  if (!value || value.length < minimum) return false;
  const normalized = value.toLowerCase();
  return !["change-this", "development", "example", "password", "replace_with", "secret-here"].some((token) => normalized.includes(token));
}

function isProductionDatabase(value: string | undefined) {
  if (!value?.startsWith("postgresql://") && !value?.startsWith("postgres://")) return false;
  const normalized = value.toLowerCase();
  return !normalized.includes("postgres:postgres@localhost") && !normalized.includes("example");
}

function isEncryptionKey(value: string | undefined) {
  if (!value) return false;
  try { return Buffer.from(value, "base64").length === 32; } catch { return false; }
}

export function getProductionReadiness() {
  const production = process.env.NODE_ENV === "production";
  const demo = process.env.DEMO_MODE === "true";
  const requireIntegrations = process.env.REQUIRE_LIVE_INTEGRATIONS === "true";
  const outboundUrl = process.env.N8N_OUTBOUND_WEBHOOK_URL;
  const outboundSecret = process.env.N8N_OUTBOUND_SECRET;
  const outboundConfigured = isHttpsUrl(outboundUrl) && isStrongSecret(outboundSecret);
  const requireProductSearch = process.env.REQUIRE_PRODUCT_SEARCH === "true";
  const productSearchUrl = process.env.PRODUCT_SEARCH_API_URL?.startsWith("/")
    ? (() => { try { return new URL(process.env.PRODUCT_SEARCH_API_URL || "", process.env.NEXT_PUBLIC_APP_URL).toString(); } catch { return ""; } })()
    : process.env.PRODUCT_SEARCH_API_URL;
  const productSearchConfigured = isHttpsUrl(productSearchUrl) && isStrongSecret(process.env.PRODUCT_SEARCH_API_KEY, 24);

  const checks: ReadinessCheck[] = [
    {
      key: "mode",
      label: "Çalışma modu",
      state: !production ? "warning" : demo ? "error" : "pass",
      detail: !production ? "Geliştirme ortamı" : demo ? "Üretimde DEMO_MODE kapatılmalı" : "Üretim modu etkin"
    },
    {
      key: "database",
      label: "PostgreSQL",
      state: demo ? "warning" : isProductionDatabase(process.env.DATABASE_URL) ? "pass" : "error",
      detail: demo ? "Demo bellek veritabanı kullanılıyor" : isProductionDatabase(process.env.DATABASE_URL) ? "Üretim veritabanı yapılandırılmış" : "Gerçek PostgreSQL DATABASE_URL gerekli"
    },
    {
      key: "auth",
      label: "Oturum anahtarı",
      state: isStrongSecret(process.env.AUTH_SECRET, 48) ? "pass" : production ? "error" : "warning",
      detail: isStrongSecret(process.env.AUTH_SECRET, 48) ? "Güçlü AUTH_SECRET mevcut" : "En az 48 karakterlik benzersiz AUTH_SECRET gerekli"
    },
    {
      key: "url",
      label: "HTTPS uygulama adresi",
      state: isHttpsUrl(process.env.NEXT_PUBLIC_APP_URL) ? "pass" : production ? "error" : "warning",
      detail: isHttpsUrl(process.env.NEXT_PUBLIC_APP_URL) ? "HTTPS adresi yapılandırılmış" : "NEXT_PUBLIC_APP_URL gerçek HTTPS adresi olmalı"
    },
    {
      key: "cookies",
      label: "Güvenli çerez",
      state: production && process.env.AUTH_COOKIE_SECURE === "false" ? "error" : "pass",
      detail: production && process.env.AUTH_COOKIE_SECURE === "false" ? "Üretimde AUTH_COOKIE_SECURE=false kullanılamaz" : "Güvenli çerez varsayılanı etkin"
    },
    {
      key: "cron",
      label: "Zamanlanmış işler",
      state: isStrongSecret(process.env.CRON_SECRET) ? "pass" : production ? "error" : "warning",
      detail: isStrongSecret(process.env.CRON_SECRET) ? "Cron çağrıları korunuyor" : "CRON_SECRET en az 32 karakter olmalı"
    },
    {
      key: "file_storage",
      label: "Şifreli hasta dosyaları",
      state: Boolean(process.env.FILE_STORAGE_ROOT?.startsWith("/") && isEncryptionKey(process.env.FILE_ENCRYPTION_KEY)) ? "pass" : production ? "error" : "warning",
      detail: Boolean(process.env.FILE_STORAGE_ROOT?.startsWith("/") && isEncryptionKey(process.env.FILE_ENCRYPTION_KEY)) ? "Harici dosya alanı ve AES-256 anahtarı yapılandırılmış" : "Mutlak FILE_STORAGE_ROOT ve 32 baytlık base64 FILE_ENCRYPTION_KEY gerekli"
    },
    {
      key: "mfa",
      label: "Personel 2FA anahtarı",
      state: isEncryptionKey(process.env.MFA_ENCRYPTION_KEY) ? "pass" : production ? "error" : "warning",
      detail: isEncryptionKey(process.env.MFA_ENCRYPTION_KEY) ? "Authenticator sırları ayrı AES-256 anahtarıyla korunuyor" : "32 baytlık base64 MFA_ENCRYPTION_KEY gerekli"
    },
    {
      key: "audit_anchor",
      label: "Audit zinciri sabitleme",
      state: isStrongSecret(process.env.AUDIT_ANCHOR_KEY) && Boolean(process.env.AUDIT_ANCHOR_REMOTE) ? "pass" : production ? "error" : "warning",
      detail: isStrongSecret(process.env.AUDIT_ANCHOR_KEY) && Boolean(process.env.AUDIT_ANCHOR_REMOTE) ? "İmzalı audit başlıkları uzak immutable hedefe aktarılıyor" : "AUDIT_ANCHOR_KEY ve AUDIT_ANCHOR_REMOTE gerekli"
    },
    {
      key: "monitoring",
      label: "Operasyon alarmı",
      state: isHttpsUrl(process.env.OPS_ALERT_WEBHOOK_URL) && isStrongSecret(process.env.OPS_ALERT_WEBHOOK_SECRET) ? "pass" : production ? "error" : "warning",
      detail: isHttpsUrl(process.env.OPS_ALERT_WEBHOOK_URL) && isStrongSecret(process.env.OPS_ALERT_WEBHOOK_SECRET) ? "İmzalı sağlık/yedek/disk alarmı yapılandırılmış" : "OPS_ALERT_WEBHOOK_URL ve güçlü OPS_ALERT_WEBHOOK_SECRET gerekli"
    },
    {
      key: "mobile_update",
      label: "İmzalı mobil güncelleme",
      state: isMobileReleaseReady() ? "pass" : production ? "error" : "warning",
      detail: isMobileReleaseReady() ? "HTTPS APK adresi ve SHA-256 sürüm manifestinde doğrulandı" : "MOBILE_MIN_VERSION, HTTPS MOBILE_APK_URL ve 64 haneli MOBILE_APK_SHA256 gerekli"
    },
    {
      key: "antivirus",
      label: "Dosya antivirüsü",
      state: process.env.FILE_AV_REQUIRED === "true" && Boolean(process.env.FILE_AV_COMMAND) ? "pass" : production ? "error" : "warning",
      detail: process.env.FILE_AV_REQUIRED === "true" && Boolean(process.env.FILE_AV_COMMAND) ? "Yüklemelerde zorunlu antivirüs taraması etkin" : "FILE_AV_REQUIRED=true ve FILE_AV_COMMAND gerekli"
    },
    {
      key: "backup",
      label: "PITR ve uzak yedek",
      state: process.env.PITR_ENABLED === "true" && Boolean(process.env.BACKUP_REMOTE) && process.env.RESTORE_TEST_SCHEDULED === "true" ? "pass" : production ? "error" : "warning",
      detail: process.env.PITR_ENABLED === "true" && Boolean(process.env.BACKUP_REMOTE) && process.env.RESTORE_TEST_SCHEDULED === "true" ? "WAL arşivi, uzak kopya ve geri yükleme testi beyan edildi" : "PITR_ENABLED, BACKUP_REMOTE ve RESTORE_TEST_SCHEDULED zorunlu"
    },
    {
      key: "inbound_webhook",
      label: "Gelen webhook",
      state: isStrongSecret(process.env.N8N_WEBHOOK_SECRET) ? "pass" : requireIntegrations ? "error" : "warning",
      detail: isStrongSecret(process.env.N8N_WEBHOOK_SECRET) ? "Webhook imzası yapılandırılmış" : "N8N_WEBHOOK_SECRET yapılandırılmadı"
    },
    {
      key: "outbound_webhook",
      label: "Canlı entegrasyon çıkışı",
      state: outboundConfigured ? "pass" : requireIntegrations ? "error" : "warning",
      detail: outboundConfigured ? "İmzalı N8N çıkışı etkin" : "N8N_OUTBOUND_WEBHOOK_URL ve N8N_OUTBOUND_SECRET gerekli"
    },
    {
      key: "product_search",
      label: "Canlı ürün fiyatları",
      state: productSearchConfigured ? "pass" : requireProductSearch ? "error" : "warning",
      detail: productSearchConfigured ? "Ürün satın alma fiyat sağlayıcısı etkin" : "PRODUCT_SEARCH_API_URL ve güçlü PRODUCT_SEARCH_API_KEY gerekli"
    }
  ];

  return {
    mode: demo ? "demo" as const : production ? "production" as const : "development" as const,
    ready: !checks.some((check) => check.state === "error"),
    checks
  };
}

export function assertProductionReady() {
  const readiness = getProductionReadiness();
  if (readiness.mode !== "production" || !readiness.ready) {
    const errors = readiness.checks.filter((check) => check.state === "error").map((check) => `${check.label}: ${check.detail}`);
    throw new Error(errors.length ? errors.join("\n") : "NODE_ENV=production ve DEMO_MODE=false gerekli.");
  }
  return readiness;
}
