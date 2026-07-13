ALTER TABLE "Payment" ADD COLUMN "isDeposit" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "StockOffer" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "seller" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "shippingPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "productUrl" TEXT NOT NULL,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StockOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockOffer_organizationId_idx" ON "StockOffer"("organizationId");
CREATE INDEX "StockOffer_itemId_unitPrice_idx" ON "StockOffer"("itemId", "unitPrice");
ALTER TABLE "StockOffer" ADD CONSTRAINT "StockOffer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockOffer" ADD CONSTRAINT "StockOffer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockOffer" ADD CONSTRAINT "StockOffer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
