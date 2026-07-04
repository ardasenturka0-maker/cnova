function extractBearer(header: string | null) {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

export function isCronRequestAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = extractBearer(request.headers.get("authorization")) ?? request.headers.get("x-cron-secret");
  return provided === secret;
}

export function isWebhookRequestAuthorized(request: Request) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) return false;
  return request.headers.get("x-webhook-secret") === secret;
}
