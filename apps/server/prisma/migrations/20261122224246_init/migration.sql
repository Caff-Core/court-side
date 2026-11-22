-- CreateTable
CREATE TABLE "facility" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "time_zone" TEXT NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_hours" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "opens_at_min" SMALLINT NOT NULL,
    "closes_at_min" SMALLINT NOT NULL,

    CONSTRAINT "opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facility_slug_key" ON "facility"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "opening_hours_facility_id_weekday_key" ON "opening_hours"("facility_id", "weekday");

-- AddForeignKey
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Custom: opening hours use ISO weekdays and 30-minute aligned windows inside
-- one local day. Prisma schema cannot express CHECK constraints.
ALTER TABLE "opening_hours"
    ADD CONSTRAINT "opening_hours_weekday_check"
        CHECK ("weekday" BETWEEN 1 AND 7),
    ADD CONSTRAINT "opening_hours_window_check"
        CHECK (
            "opens_at_min" >= 0
            AND "closes_at_min" <= 1440
            AND "opens_at_min" < "closes_at_min"
        ),
    ADD CONSTRAINT "opening_hours_slot_alignment_check"
        CHECK ("opens_at_min" % 30 = 0 AND "closes_at_min" % 30 = 0);
