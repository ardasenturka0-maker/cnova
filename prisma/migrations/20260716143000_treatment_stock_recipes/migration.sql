CREATE TABLE "StockRecipe" (
    "id" TEXT NOT NULL,
    "treatmentKey" TEXT NOT NULL,
    "treatmentType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StockRecipe_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StockMovement" ADD COLUMN "treatmentId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "appointmentId" TEXT;

CREATE UNIQUE INDEX "StockRecipe_organizationId_branchId_treatmentKey_itemId_key"
ON "StockRecipe"("organizationId", "branchId", "treatmentKey", "itemId");
CREATE INDEX "StockRecipe_organizationId_branchId_treatmentKey_idx"
ON "StockRecipe"("organizationId", "branchId", "treatmentKey");
CREATE INDEX "StockRecipe_itemId_idx" ON "StockRecipe"("itemId");
CREATE INDEX "StockMovement_treatmentId_idx" ON "StockMovement"("treatmentId");
CREATE INDEX "StockMovement_appointmentId_idx" ON "StockMovement"("appointmentId");

ALTER TABLE "StockRecipe" ADD CONSTRAINT "StockRecipe_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockRecipe" ADD CONSTRAINT "StockRecipe_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockRecipe" ADD CONSTRAINT "StockRecipe_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_treatmentId_fkey"
FOREIGN KEY ("treatmentId") REFERENCES "Treatment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
