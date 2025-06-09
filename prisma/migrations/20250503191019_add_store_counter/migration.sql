-- CreateTable
CREATE TABLE "store_counters" (
    "storeId" TEXT NOT NULL,
    "lastSaleNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_counters_pkey" PRIMARY KEY ("storeId")
);

-- AddForeignKey
ALTER TABLE "store_counters" ADD CONSTRAINT "store_counters_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
