-- Audit P1 / Batch F: persist Mafia and GameRoom host-owner identity so the
-- original streamer keeps host ownership of an active room even after a
-- server restart (deploy, OOM, etc.). Mirrors the existing in-memory
-- `mafiaRoomOwnerStore.ts` and `gameRoomOwnerStore.ts` stores; the in-memory
-- map remains the fast path, this table is the durability backstop.

-- CreateTable
CREATE TABLE "MafiaRoomOwner" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MafiaRoomOwner_pkey" PRIMARY KEY ("roomId")
);

-- CreateIndex
CREATE INDEX "MafiaRoomOwner_expiresAt_idx" ON "MafiaRoomOwner"("expiresAt");

-- CreateTable
CREATE TABLE "GameRoomOwner" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameRoomOwner_pkey" PRIMARY KEY ("roomId")
);

-- CreateIndex
CREATE INDEX "GameRoomOwner_expiresAt_idx" ON "GameRoomOwner"("expiresAt");
