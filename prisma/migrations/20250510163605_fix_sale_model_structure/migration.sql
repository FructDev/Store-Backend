/*
  Warnings:

  - You are about to drop the `_RepairOrderToSale` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[saleId]` on the table `repair_orders` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "_RepairOrderToSale" DROP CONSTRAINT "_RepairOrderToSale_A_fkey";

-- DropForeignKey
ALTER TABLE "_RepairOrderToSale" DROP CONSTRAINT "_RepairOrderToSale_B_fkey";

-- AlterTable
ALTER TABLE "repair_orders" ADD COLUMN     "saleId" TEXT;

-- DropTable
DROP TABLE "_RepairOrderToSale";

-- CreateIndex
CREATE UNIQUE INDEX "repair_orders_saleId_key" ON "repair_orders"("saleId");
