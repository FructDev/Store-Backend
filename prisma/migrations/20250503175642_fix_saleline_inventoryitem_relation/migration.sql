/*
  Warnings:

  - You are about to drop the column `saleLineId` on the `inventory_items` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[storeId,saleNumber]` on the table `sales` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `lineNumber` to the `sale_lines` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lineTotal` to the `sale_lines` table without a default value. This is not possible if the table is not empty.
  - Added the required column `saleNumber` to the `sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `sales` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'COMPLETED', 'CANCELLED', 'RETURNED', 'PARTIALLY_RETURNED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD_DEBIT', 'CARD_CREDIT', 'TRANSFER', 'MOBILE_WALLET', 'STORE_CREDIT', 'GIFT_CARD', 'OTHER');

-- DropIndex
DROP INDEX "inventory_items_saleLineId_key";

-- AlterTable
ALTER TABLE "inventory_items" DROP COLUMN "saleLineId";

-- AlterTable
ALTER TABLE "sale_lines" ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lineNumber" INTEGER NOT NULL,
ADD COLUMN     "lineTotal" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "miscItemDescription" TEXT,
ADD COLUMN     "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unitCost" DECIMAL(10,2),
ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "amountDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ncf" TEXT,
ADD COLUMN     "ncfExpiration" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "saleNumber" TEXT NOT NULL,
ADD COLUMN     "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "subTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_payments" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_storeId_phone_idx" ON "customers"("storeId", "phone");

-- CreateIndex
CREATE INDEX "sale_payments_saleId_idx" ON "sale_payments"("saleId");

-- CreateIndex
CREATE INDEX "sale_payments_storeId_paymentDate_idx" ON "sale_payments"("storeId", "paymentDate");

-- CreateIndex
CREATE INDEX "sale_lines_saleId_idx" ON "sale_lines"("saleId");

-- CreateIndex
CREATE INDEX "sale_lines_productId_idx" ON "sale_lines"("productId");

-- CreateIndex
CREATE INDEX "sale_lines_inventoryItemId_idx" ON "sale_lines"("inventoryItemId");

-- CreateIndex
CREATE INDEX "sales_storeId_saleDate_idx" ON "sales"("storeId", "saleDate");

-- CreateIndex
CREATE INDEX "sales_storeId_customerId_idx" ON "sales"("storeId", "customerId");

-- CreateIndex
CREATE INDEX "sales_storeId_userId_idx" ON "sales"("storeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_storeId_saleNumber_key" ON "sales"("storeId", "saleNumber");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
