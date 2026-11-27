-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'expired');

-- AlterTable
ALTER TABLE "schedule_entry" ADD COLUMN     "booking_id" UUID;

-- CreateTable
CREATE TABLE "booking" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_attempt" (
    "id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "facility_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status_code" SMALLINT NOT NULL,
    "response" JSONB NOT NULL,
    "booking_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_account_id_facility_id_status_idx" ON "booking"("account_id", "facility_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "booking_attempt_account_id_key_key" ON "booking_attempt"("account_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_entry_booking_id_key" ON "schedule_entry"("booking_id");

-- AddForeignKey
ALTER TABLE "schedule_entry" ADD CONSTRAINT "schedule_entry_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_attempt" ADD CONSTRAINT "booking_attempt_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_attempt" ADD CONSTRAINT "booking_attempt_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_attempt" ADD CONSTRAINT "booking_attempt_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Custom constraints. Prisma schema cannot express CHECK or EXCLUDE.

-- Holds and bookings may never overlap for one facility. Ranges are
-- start-inclusive and end-exclusive, so adjacent entries share an endpoint.
-- Events, blocks and closures may overlap; the facility transaction checks
-- them. btree_gist lets the uuid equality join the range overlap in one index.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "schedule_entry"
    ADD CONSTRAINT "schedule_entry_reservation_overlap_excl"
        EXCLUDE USING gist (
            "facility_id" WITH =,
            tstzrange("starts_at", "ends_at", '[)') WITH &&
        ) WHERE ("kind" IN ('hold', 'booking'));

-- A booking ends after it starts, and a pending one always has a deadline.
ALTER TABLE "booking"
    ADD CONSTRAINT "booking_range_check" CHECK ("ends_at" > "starts_at"),
    ADD CONSTRAINT "booking_pending_expiry_check"
        CHECK ("status" <> 'pending' OR "expires_at" IS NOT NULL);
