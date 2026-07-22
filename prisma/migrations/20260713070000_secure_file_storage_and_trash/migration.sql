-- Patient media moves to encrypted file storage. `data` remains nullable only for
-- a rolling migration; new uploads never write file bodies to PostgreSQL.
ALTER TABLE "PatientFile" ALTER COLUMN "data" DROP NOT NULL;
ALTER TABLE "PatientFile"
  ADD COLUMN "storageKey" TEXT,
  ADD COLUMN "checksumSha256" TEXT,
  ADD COLUMN "storedMimeType" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "purgeAt" TIMESTAMP(3),
  ADD COLUMN "deletedById" TEXT,
  ADD COLUMN "restoredAt" TIMESTAMP(3),
  ADD COLUMN "restoredById" TEXT;

ALTER TABLE "Patient"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "purgeAt" TIMESTAMP(3),
  ADD COLUMN "deletedById" TEXT,
  ADD COLUMN "restoredAt" TIMESTAMP(3),
  ADD COLUMN "restoredById" TEXT;

CREATE UNIQUE INDEX "PatientFile_storageKey_key" ON "PatientFile"("storageKey");
CREATE INDEX "PatientFile_organizationId_deletedAt_idx" ON "PatientFile"("organizationId", "deletedAt");
CREATE INDEX "PatientFile_purgeAt_idx" ON "PatientFile"("purgeAt");
CREATE INDEX "Patient_organizationId_deletedAt_idx" ON "Patient"("organizationId", "deletedAt");
CREATE INDEX "Patient_purgeAt_idx" ON "Patient"("purgeAt");
