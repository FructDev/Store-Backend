-- AlterTable
ALTER TABLE "repair_orders" ADD COLUMN     "intakeChecklist" JSONB,
ADD COLUMN     "postRepairChecklist" JSONB;
