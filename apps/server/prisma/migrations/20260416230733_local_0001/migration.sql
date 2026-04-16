-- DropIndex
DROP INDEX "UserStreamerStats_streamerId_wins_idx";

-- AlterTable
ALTER TABLE "UserStreamerStats" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "GameRound_streamerId_createdAt_idx" ON "GameRound"("streamerId", "createdAt");

-- CreateIndex
CREATE INDEX "UserStreamerStats_streamerId_wins_idx" ON "UserStreamerStats"("streamerId", "wins");
