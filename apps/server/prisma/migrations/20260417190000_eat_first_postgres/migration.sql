-- Eat-first game state (migrated off client Firestore).

CREATE TABLE "EatFirstGame" (
    "id" TEXT NOT NULL,
    "room" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EatFirstGame_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EatFirstPlayer" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "EatFirstPlayer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EatFirstVote" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "voterSlotId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "EatFirstVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EatFirstPlayer_gameId_slotId_key" ON "EatFirstPlayer"("gameId", "slotId");

CREATE INDEX "EatFirstPlayer_gameId_idx" ON "EatFirstPlayer"("gameId");

CREATE UNIQUE INDEX "EatFirstVote_gameId_voterSlotId_key" ON "EatFirstVote"("gameId", "voterSlotId");

CREATE INDEX "EatFirstVote_gameId_idx" ON "EatFirstVote"("gameId");

ALTER TABLE "EatFirstPlayer" ADD CONSTRAINT "EatFirstPlayer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "EatFirstGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EatFirstVote" ADD CONSTRAINT "EatFirstVote_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "EatFirstGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
