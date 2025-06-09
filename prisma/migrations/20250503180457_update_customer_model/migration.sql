-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "customers_storeId_isActive_idx" ON "customers"("storeId", "isActive");
