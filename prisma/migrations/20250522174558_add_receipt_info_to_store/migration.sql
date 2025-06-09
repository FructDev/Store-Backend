-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "logoUrl" VARCHAR(255),
ADD COLUMN     "receiptFooterNotes" TEXT,
ADD COLUMN     "rnc" VARCHAR(20),
ALTER COLUMN "currencySymbol" SET DEFAULT 'RD$';
