-- Wordle round persistence (no FK to User — keeps existing User/UserStats relations unchanged)

CREATE TABLE "GameRound" (
    "id" TEXT NOT NULL,
    "winnerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "isWinner" BOOLEAN NOT NULL,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GameResult_roundId_idx" ON "GameResult"("roundId");
CREATE INDEX "GameResult_userId_idx" ON "GameResult"("userId");

ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "GameRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
