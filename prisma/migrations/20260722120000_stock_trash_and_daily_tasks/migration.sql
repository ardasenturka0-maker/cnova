ALTER TABLE "StockItem"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "purgeAt" TIMESTAMP(3),
  ADD COLUMN "deletedById" TEXT,
  ADD COLUMN "restoredAt" TIMESTAMP(3),
  ADD COLUMN "restoredById" TEXT;

CREATE INDEX "StockItem_organizationId_deletedAt_idx" ON "StockItem"("organizationId", "deletedAt");
CREATE INDEX "StockItem_purgeAt_idx" ON "StockItem"("purgeAt");

ALTER TABLE "Task" ADD COLUMN "sourceKey" TEXT;
CREATE UNIQUE INDEX "Task_organizationId_sourceKey_key" ON "Task"("organizationId", "sourceKey");
