export const authCookieName = "clinicnova_session";

export function getAuthSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "development-secret-change-me-please-32-chars");
}
