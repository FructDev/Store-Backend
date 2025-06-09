-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "currencySymbol" TEXT DEFAULT '$',
ADD COLUMN     "defaultRepairWarrantyDays" INTEGER DEFAULT 30,
ADD COLUMN     "quoteTerms" TEXT,
ADD COLUMN     "repairTerms" TEXT,
ADD COLUMN     "website" TEXT;
