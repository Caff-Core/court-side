-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('booking_blocked');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'booking_approved';
ALTER TYPE "AuditAction" ADD VALUE 'booking_cancelled';
ALTER TYPE "AuditAction" ADD VALUE 'booking_no_show';
ALTER TYPE "AuditAction" ADD VALUE 'booking_blocked';
ALTER TYPE "AuditAction" ADD VALUE 'booking_unblocked';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'cancelled';
ALTER TYPE "BookingStatus" ADD VALUE 'no_show';
ALTER TYPE "BookingStatus" ADD VALUE 'blocked';

-- AlterTable
ALTER TABLE "booking" ADD COLUMN     "status_changed_at" TIMESTAMPTZ(3),
ADD COLUMN     "status_reason" TEXT;

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "booking_id" UUID,
    "message" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(3),

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_dedupe_key_key" ON "notification"("dedupe_key");

-- CreateIndex
CREATE INDEX "notification_recipient_id_created_at_idx" ON "notification"("recipient_id", "created_at");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Custom constraint. An Admin block always records its reason.
ALTER TABLE "booking"
    ADD CONSTRAINT "booking_block_reason_check"
        CHECK ("status" <> 'blocked' OR "status_reason" IS NOT NULL);
