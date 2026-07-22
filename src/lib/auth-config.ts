export const authCookieName = "clinicnova_session";
export const authIssuer = "clinicnova";
export const authAudience = "clinicnova-app";

export function shouldUseSecureCookies(request?: Request) {
  if (process.env.AUTH_COOKIE_SECURE === "true") return true;
  if (process.env.AUTH_COOKIE_SECURE === "false") return false;

  if (request) {
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (forwardedProtocol === "https") return true;

    const url = new URL(request.url);
    if (url.protocol === "https:") return true;
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return false;
  }

  return process.env.NODE_ENV === "production";
}

export function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (secret && secret.length >= 32) {
    return new TextEncoder().encode(secret);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET production ortamında en az 32 karakter olmalıdır.");
  }

  return new TextEncoder().encode("clinicnova-local-development-secret-32-chars");
}
