/*
  Warnings:

  - You are about to drop the `_RepairLineToInventoryItem` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[inventoryItemId]` on the table `repair_lines` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "_RepairLineToInventoryItem" DROP CONSTRAINT "_RepairLineToInventoryItem_A_fkey";

-- DropForeignKey
ALTER TABLE "_RepairLineToInventoryItem" DROP CONSTRAINT "_RepairLineToInventoryItem_B_fkey";

-- DropTable
DROP TABLE "_RepairLineToInventoryItem";

-- CreateIndex
CREATE UNIQUE INDEX "repair_lines_inventoryItemId_key" ON "repair_lines"("inventoryItemId");
