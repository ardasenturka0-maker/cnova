import { randomBytes } from "node:crypto";

const secret = (bytes = 48) => randomBytes(bytes).toString("base64url");
const key = () => randomBytes(32).toString("base64");
const fileKey = key();
const mfaKey = key();

console.log(`AUTH_SECRET="${secret()}"`);
console.log(`CRON_SECRET="${secret(32)}"`);
console.log(`N8N_WEBHOOK_SECRET="${secret(32)}"`);
console.log(`N8N_OUTBOUND_SECRET="${secret(32)}"`);
console.log(`PRODUCT_SEARCH_API_KEY="${secret(32)}"`);
console.log(`FILE_ENCRYPTION_KEY="${fileKey}"`);
console.log(`FILE_ENCRYPTION_KEYS='{"2026-07":"${fileKey}"}'`);
console.log('FILE_ENCRYPTION_ACTIVE_KEY_ID="2026-07"');
console.log(`MFA_ENCRYPTION_KEY="${mfaKey}"`);
console.log(`MFA_ENCRYPTION_KEYS='{"2026-07":"${mfaKey}"}'`);
console.log('MFA_ENCRYPTION_ACTIVE_KEY_ID="2026-07"');
console.log(`AUDIT_ANCHOR_KEY="${secret(32)}"`);
console.log(`OPS_ALERT_WEBHOOK_SECRET="${secret(32)}"`);
