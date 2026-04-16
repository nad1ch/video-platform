-- CreateTable
CREATE TABLE "Streamer" (
    "id" TEXT NOT NULL,
    "twitchId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Streamer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Streamer_twitchId_key" ON "Streamer"("twitchId");

-- CreateIndex
CREATE UNIQUE INDEX "Streamer_username_key" ON "Streamer"("username");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "streamerId" TEXT;

-- CreateIndex
CREATE INDEX "User_streamerId_idx" ON "User"("streamerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "Streamer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Example seed (replace twitch id/login, generate new cuid for id if you prefer):
-- INSERT INTO "Streamer" ("id", "twitchId", "username", "isActive")
-- VALUES ('clxxxxxxxxxxxxxxxxxxxxxx01', '123456789', 'nad1ch', true);
