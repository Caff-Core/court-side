-- CreateEnum
CREATE TYPE "ScheduleEntryKind" AS ENUM ('hold', 'booking', 'event', 'block', 'closure');

-- CreateTable
CREATE TABLE "schedule_entry" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "kind" "ScheduleEntryKind" NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "account_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_entry_facility_id_starts_at_idx" ON "schedule_entry"("facility_id", "starts_at");

-- AddForeignKey
ALTER TABLE "schedule_entry" ADD CONSTRAINT "schedule_entry_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_entry" ADD CONSTRAINT "schedule_entry_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Custom constraints. Prisma schema cannot express CHECK constraints.
-- Ranges are start-inclusive and end-exclusive, so an entry must end after it
-- starts. Only holds expire, and every hold has a deadline.
ALTER TABLE "schedule_entry"
    ADD CONSTRAINT "schedule_entry_range_check" CHECK ("ends_at" > "starts_at"),
    ADD CONSTRAINT "schedule_entry_hold_expiry_check"
        CHECK (("kind" = 'hold') = ("expires_at" IS NOT NULL));
