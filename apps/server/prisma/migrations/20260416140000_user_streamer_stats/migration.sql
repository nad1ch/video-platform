-- Per-user Wordle stats scoped to a Streamer (multi-tenant).
CREATE TABLE "UserStreamerStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserStreamerStats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserStreamerStats_userId_streamerId_key" ON "UserStreamerStats"("userId", "streamerId");

CREATE INDEX "UserStreamerStats_streamerId_wins_idx" ON "UserStreamerStats"("streamerId", "wins" DESC);

CREATE INDEX "UserStreamerStats_userId_idx" ON "UserStreamerStats"("userId");

ALTER TABLE "UserStreamerStats" ADD CONSTRAINT "UserStreamerStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserStreamerStats" ADD CONSTRAINT "UserStreamerStats_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
