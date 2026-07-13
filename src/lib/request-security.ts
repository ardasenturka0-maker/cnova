export function isTrustedMutationRequest(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowed = new Set<string>();
  try { allowed.add(new URL(request.url).origin); } catch { return false; }
  try { if (process.env.NEXT_PUBLIC_APP_URL) allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin); } catch { return false; }
  try { return allowed.has(new URL(origin).origin); } catch { return false; }
}
