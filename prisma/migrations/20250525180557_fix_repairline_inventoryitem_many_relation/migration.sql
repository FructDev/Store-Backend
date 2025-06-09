-- AlterEnum
ALTER TYPE "RepairStatus" ADD VALUE 'QUOTE_APPROVED';

-- DropIndex
DROP INDEX "repair_lines_inventoryItemId_key";

-- CreateTable
CREATE TABLE "_RepairLineToInventoryItem" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RepairLineToInventoryItem_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RepairLineToInventoryItem_B_index" ON "_RepairLineToInventoryItem"("B");

-- AddForeignKey
ALTER TABLE "_RepairLineToInventoryItem" ADD CONSTRAINT "_RepairLineToInventoryItem_A_fkey" FOREIGN KEY ("A") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RepairLineToInventoryItem" ADD CONSTRAINT "_RepairLineToInventoryItem_B_fkey" FOREIGN KEY ("B") REFERENCES "repair_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
