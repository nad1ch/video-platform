-- Link persisted Nadle rounds to a Streamer (multi-tenant history).
ALTER TABLE "GameRound" ADD COLUMN "streamerId" TEXT;

CREATE INDEX "GameRound_streamerId_idx" ON "GameRound"("streamerId");

ALTER TABLE "GameRound"
ADD CONSTRAINT "GameRound_streamerId_fkey"
FOREIGN KEY ("streamerId") REFERENCES "Streamer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
