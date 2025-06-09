/*
  Warnings:

  - A unique constraint covering the columns `[repairOrderId]` on the table `sales` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('RECEIVED', 'DIAGNOSING', 'QUOTE_PENDING', 'AWAITING_QUOTE_APPROVAL', 'QUOTE_REJECTED', 'AWAITING_PARTS', 'IN_REPAIR', 'ASSEMBLING', 'TESTING_QC', 'REPAIR_COMPLETED', 'PENDING_PICKUP', 'COMPLETED_PICKED_UP', 'CANCELLED', 'UNREPAIRABLE');

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "repairOrderId" TEXT;

-- CreateTable
CREATE TABLE "repair_orders" (
    "id" TEXT NOT NULL,
    "repairNumber" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT,
    "deviceBrand" TEXT NOT NULL,
    "deviceModel" TEXT NOT NULL,
    "deviceImei" TEXT,
    "deviceColor" TEXT,
    "devicePassword" TEXT,
    "accessoriesReceived" TEXT,
    "reportedIssue" TEXT NOT NULL,
    "intakeNotes" TEXT,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "technicianId" TEXT,
    "diagnosticNotes" TEXT,
    "quotedAmount" DECIMAL(10,2),
    "quoteApproved" BOOLEAN,
    "quoteStatusDate" TIMESTAMP(3),
    "estimatedCompletionDate" TIMESTAMP(3),
    "status" "RepairStatus" NOT NULL DEFAULT 'RECEIVED',
    "completionNotes" TEXT,
    "completedAt" TIMESTAMP(3),
    "warrantyPeriodDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_status_history" (
    "id" TEXT NOT NULL,
    "repairOrderId" TEXT NOT NULL,
    "status" "RepairStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "repair_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_lines" (
    "id" TEXT NOT NULL,
    "repairOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "miscDescription" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "unitCost" DECIMAL(10,2),
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "inventoryItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RepairOrderToSale" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RepairOrderToSale_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "repair_orders_storeId_status_idx" ON "repair_orders"("storeId", "status");

-- CreateIndex
CREATE INDEX "repair_orders_storeId_customerId_idx" ON "repair_orders"("storeId", "customerId");

-- CreateIndex
CREATE INDEX "repair_orders_storeId_technicianId_idx" ON "repair_orders"("storeId", "technicianId");

-- CreateIndex
CREATE INDEX "repair_orders_deviceImei_idx" ON "repair_orders"("deviceImei");

-- CreateIndex
CREATE UNIQUE INDEX "repair_orders_storeId_repairNumber_key" ON "repair_orders"("storeId", "repairNumber");

-- CreateIndex
CREATE INDEX "repair_status_history_repairOrderId_changedAt_idx" ON "repair_status_history"("repairOrderId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "repair_lines_inventoryItemId_key" ON "repair_lines"("inventoryItemId");

-- CreateIndex
CREATE INDEX "repair_lines_repairOrderId_idx" ON "repair_lines"("repairOrderId");

-- CreateIndex
CREATE INDEX "repair_lines_productId_idx" ON "repair_lines"("productId");

-- CreateIndex
CREATE INDEX "repair_lines_inventoryItemId_idx" ON "repair_lines"("inventoryItemId");

-- CreateIndex
CREATE INDEX "_RepairOrderToSale_B_index" ON "_RepairOrderToSale"("B");

-- CreateIndex
CREATE UNIQUE INDEX "sales_repairOrderId_key" ON "sales"("repairOrderId");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_repairOrderId_fkey" FOREIGN KEY ("repairOrderId") REFERENCES "repair_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_orders" ADD CONSTRAINT "repair_orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_orders" ADD CONSTRAINT "repair_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_orders" ADD CONSTRAINT "repair_orders_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_orders" ADD CONSTRAINT "repair_orders_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_status_history" ADD CONSTRAINT "repair_status_history_repairOrderId_fkey" FOREIGN KEY ("repairOrderId") REFERENCES "repair_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_status_history" ADD CONSTRAINT "repair_status_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_lines" ADD CONSTRAINT "repair_lines_repairOrderId_fkey" FOREIGN KEY ("repairOrderId") REFERENCES "repair_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_lines" ADD CONSTRAINT "repair_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_lines" ADD CONSTRAINT "repair_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RepairOrderToSale" ADD CONSTRAINT "_RepairOrderToSale_A_fkey" FOREIGN KEY ("A") REFERENCES "repair_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RepairOrderToSale" ADD CONSTRAINT "_RepairOrderToSale_B_fkey" FOREIGN KEY ("B") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
