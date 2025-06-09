/*
  Warnings:

  - A unique constraint covering the columns `[defaultReturnLocationId]` on the table `stores` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[defaultPoReceiveLocationId]` on the table `stores` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "acceptedPaymentMethods" "PaymentMethod"[],
ADD COLUMN     "defaultPoReceiveLocationId" TEXT,
ADD COLUMN     "defaultReturnLocationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "stores_defaultReturnLocationId_key" ON "stores"("defaultReturnLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "stores_defaultPoReceiveLocationId_key" ON "stores"("defaultPoReceiveLocationId");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_defaultReturnLocationId_fkey" FOREIGN KEY ("defaultReturnLocationId") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_defaultPoReceiveLocationId_fkey" FOREIGN KEY ("defaultPoReceiveLocationId") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
