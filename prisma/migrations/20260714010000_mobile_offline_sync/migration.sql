CREATE TABLE "MobileSyncRecord" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "serverEntityId" TEXT,
  "payloadHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MobileSyncRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileSyncRecord_organizationId_deviceId_operationId_key"
  ON "MobileSyncRecord"("organizationId", "deviceId", "operationId");
CREATE INDEX "MobileSyncRecord_organizationId_deviceId_entityType_clientId_idx"
  ON "MobileSyncRecord"("organizationId", "deviceId", "entityType", "clientId");
CREATE INDEX "MobileSyncRecord_serverEntityId_idx" ON "MobileSyncRecord"("serverEntityId");

ALTER TABLE "MobileSyncRecord"
  ADD CONSTRAINT "MobileSyncRecord_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
