-- AlterTable
ALTER TABLE "sale_payments" ADD COLUMN     "amountTendered" DECIMAL(12,2),
ADD COLUMN     "cardAuthCode" TEXT,
ADD COLUMN     "cardLast4" TEXT,
ADD COLUMN     "changeGiven" DECIMAL(12,2),
ADD COLUMN     "transferConfirmation" TEXT;
