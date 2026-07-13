import { prisma } from "@/lib/prisma";

type AuditIntegrityRow = {
  id: string;
  organizationId: string;
  previousHash: string | null;
  entryHash: string | null;
  expectedHash: string | null;
};

const zeroHash = "0".repeat(64);

export async function verifyAuditIntegrity(organizationId?: string) {
  const rows = await prisma.$queryRaw<AuditIntegrityRow[]>`
    SELECT "id", "organizationId", "previousHash", "entryHash",
      CASE WHEN "previousHash" = repeat('0', 64) THEN "entryHash"
      ELSE encode(digest(concat_ws('|',
        "previousHash", "id", "organizationId",
        COALESCE("branchId", ''), COALESCE("userId", ''),
        "action", "module", COALESCE("entityId", ''),
        COALESCE("metadata"::text, ''), COALESCE("ip", ''),
        COALESCE("userAgent", ''),
        to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ), 'sha256'), 'hex') END AS "expectedHash"
    FROM "AuditLog"
    WHERE (${organizationId ?? null}::text IS NULL OR "organizationId" = ${organizationId ?? null})
    ORDER BY "organizationId" ASC, "createdAt" ASC, "id" ASC
  `;
  const latest = new Map<string, string>();
  const errors: string[] = [];
  for (const row of rows) {
    if (!row.entryHash || !row.previousHash) { errors.push(`${row.id}: hash eksik`); continue; }
    const prior = latest.get(row.organizationId);
    if (row.previousHash !== zeroHash && row.previousHash !== prior) errors.push(`${row.id}: önceki hash bağlantısı bozuk`);
    if (row.previousHash !== zeroHash && row.entryHash !== row.expectedHash) errors.push(`${row.id}: içerik hash'i bozuk`);
    latest.set(row.organizationId, row.entryHash);
  }
  return { valid: errors.length === 0, checked: rows.length, organizations: latest.size, errors };
}
