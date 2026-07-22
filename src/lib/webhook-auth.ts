import { timingSafeEqual } from "node:crypto";

function extractBearer(header: string | null) {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

function safeSecretEqual(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isCronRequestAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = extractBearer(request.headers.get("authorization")) ?? request.headers.get("x-cron-secret");
  return safeSecretEqual(provided, secret);
}

export function isWebhookRequestAuthorized(request: Request) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) return false;
  const provided = extractBearer(request.headers.get("authorization")) ?? request.headers.get("x-webhook-secret");
  return safeSecretEqual(provided, secret);
}

export function getWebhookOrganizationSlug(request: Request) {
  const slug = request.headers.get("x-clinicnova-organization")?.trim().toLowerCase();
  return slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}
