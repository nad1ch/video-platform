-- Streamer: public slug `name` + optional owner (admin-created rows).
ALTER TABLE "Streamer" ADD COLUMN "name" TEXT;
ALTER TABLE "Streamer" ADD COLUMN "ownerId" TEXT;

UPDATE "Streamer" SET "name" = "username" WHERE "name" IS NULL;

ALTER TABLE "Streamer" ALTER COLUMN "name" SET NOT NULL;

CREATE UNIQUE INDEX "Streamer_name_key" ON "Streamer"("name");

CREATE INDEX "Streamer_ownerId_idx" ON "Streamer"("ownerId");

ALTER TABLE "Streamer" ADD CONSTRAINT "Streamer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
