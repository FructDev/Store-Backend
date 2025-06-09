-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- AlterTable
ALTER TABLE "sale_lines" ADD COLUMN     "discountType" "DiscountType",
ADD COLUMN     "discountValue" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "discountOnTotalType" "DiscountType",
ADD COLUMN     "discountOnTotalValue" DECIMAL(12,2);
