import packageInfo from "../../package.json";

function versionParts(value: string) {
  if (!/^\d+\.\d+\.\d+$/.test(value)) return null;
  return value.split(".").map(Number);
}

export function compareVersions(left: string, right: string) {
  const a = versionParts(left); const b = versionParts(right);
  if (!a || !b) throw new Error("Mobil sürüm semver biçiminde olmalıdır.");
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  return 0;
}

export function getMobileRelease() {
  const currentVersion = packageInfo.version;
  const minimumVersion = process.env.MOBILE_MIN_VERSION || currentVersion;
  const apkUrl = process.env.MOBILE_APK_URL;
  const sha256 = process.env.MOBILE_APK_SHA256?.toLowerCase();
  compareVersions(currentVersion, minimumVersion);
  if (compareVersions(minimumVersion, currentVersion) > 0) throw new Error("MOBILE_MIN_VERSION güncel uygulama sürümünden büyük olamaz.");
  if (!apkUrl || new URL(apkUrl).protocol !== "https:") throw new Error("MOBILE_APK_URL HTTPS olmalıdır.");
  if (!sha256 || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error("MOBILE_APK_SHA256 geçerli bir SHA-256 olmalıdır.");
  return { currentVersion, minimumVersion, apkUrl, sha256 };
}

export function isMobileReleaseReady() {
  try { getMobileRelease(); return true; } catch { return false; }
}
