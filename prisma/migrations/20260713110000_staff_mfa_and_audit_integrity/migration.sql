CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "User"
  ADD COLUMN "mfaSecretEncrypted" TEXT,
  ADD COLUMN "mfaPendingSecretEncrypted" TEXT,
  ADD COLUMN "mfaPendingExpiresAt" TIMESTAMP(3),
  ADD COLUMN "mfaEnabledAt" TIMESTAMP(3),
  ADD COLUMN "mfaRecoveryCodeHashes" JSONB,
  ADD COLUMN "mfaLastUsedCounter" INTEGER NOT NULL DEFAULT -1;

ALTER TABLE "AuditLog"
  ADD COLUMN "previousHash" TEXT,
  ADD COLUMN "entryHash" TEXT;

CREATE UNIQUE INDEX "AuditLog_entryHash_key" ON "AuditLog"("entryHash");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

CREATE OR REPLACE FUNCTION clinicnova_audit_hash() RETURNS trigger AS $$
DECLARE
  prior_hash TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."organizationId", 0));
  SELECT "entryHash" INTO prior_hash
    FROM "AuditLog"
   WHERE "organizationId" = NEW."organizationId" AND "entryHash" IS NOT NULL
   ORDER BY "createdAt" DESC, "id" DESC
   LIMIT 1;

  NEW."previousHash" := COALESCE(prior_hash, repeat('0', 64));
  NEW."entryHash" := encode(digest(concat_ws('|',
    NEW."previousHash", NEW."id", NEW."organizationId",
    COALESCE(NEW."branchId", ''), COALESCE(NEW."userId", ''),
    NEW."action", NEW."module", COALESCE(NEW."entityId", ''),
    COALESCE(NEW."metadata"::text, ''), COALESCE(NEW."ip", ''),
    COALESCE(NEW."userAgent", ''),
    to_char(NEW."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ), 'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_hash_before_insert"
BEFORE INSERT ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION clinicnova_audit_hash();

-- Existing records become immutable anchors; new records form a per-tenant chain.
UPDATE "AuditLog"
SET "previousHash" = repeat('0', 64),
    "entryHash" = encode(digest(concat_ws('|', "id", "organizationId", "action", "module", "createdAt"::text), 'sha256'), 'hex')
WHERE "entryHash" IS NULL;

CREATE OR REPLACE FUNCTION clinicnova_audit_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog records are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_immutable_update"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION clinicnova_audit_immutable();
