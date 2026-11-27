-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'closure_created';
ALTER TYPE "AuditAction" ADD VALUE 'closure_ended';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'booking_cancelled_closure';

-- AlterTable
ALTER TABLE "schedule_entry" ADD COLUMN     "closure_id" UUID;

-- CreateTable
CREATE TABLE "closure" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "cancelled_bookings" INTEGER NOT NULL DEFAULT 0,
    "ended_at" TIMESTAMPTZ(3),
    "ended_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "closure_facility_id_starts_at_idx" ON "closure"("facility_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "closure_created_by_id_key_key" ON "closure"("created_by_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_entry_closure_id_key" ON "schedule_entry"("closure_id");

-- AddForeignKey
ALTER TABLE "schedule_entry" ADD CONSTRAINT "schedule_entry_closure_id_fkey" FOREIGN KEY ("closure_id") REFERENCES "closure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closure" ADD CONSTRAINT "closure_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closure" ADD CONSTRAINT "closure_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closure" ADD CONSTRAINT "closure_ended_by_id_fkey" FOREIGN KEY ("ended_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Custom constraints. A closure ends after it starts and has a reason.
ALTER TABLE "closure"
    ADD CONSTRAINT "closure_range_check" CHECK ("ends_at" > "starts_at"),
    ADD CONSTRAINT "closure_reason_check" CHECK (length(btrim("reason")) > 0);
