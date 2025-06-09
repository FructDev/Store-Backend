-- AlterTable
ALTER TABLE "store_counters" ADD COLUMN     "lastPoNumber" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "poNumberPadding" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "poNumberPrefix" TEXT NOT NULL DEFAULT 'PO-',
ADD COLUMN     "repairNumberPadding" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "repairNumberPrefix" TEXT NOT NULL DEFAULT 'REP-',
ADD COLUMN     "saleNumberPadding" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "saleNumberPrefix" TEXT NOT NULL DEFAULT 'VTA-';
