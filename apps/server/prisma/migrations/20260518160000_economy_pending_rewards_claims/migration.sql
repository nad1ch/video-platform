-- Viewer Economy: typed PendingReward rows + Claim history + XP ledger.
--
-- Additive only. The legacy `Pending` table (flat per-user counter) is
-- preserved so existing CoinHub claim semantics keep working — the new
-- `claimPending` flow consumes BOTH legacy `Pending.amount` AND unexpired
-- `PendingReward` rows in one Serializable transaction.
--
-- Phase 1 (PendingReward + Claim) and Phase 2 (XpBalance + XpTransaction)
-- ship together because the claim path must credit coins and XP atomically
-- in the same transaction.

-- CreateTable
CREATE TABLE "PendingReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "coinAmount" INTEGER NOT NULL DEFAULT 0,
    "xpAmount" INTEGER NOT NULL DEFAULT 0,
    "streamerId" TEXT,
    "sourceRef" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingReward_idempotencyKey_key" ON "PendingReward"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PendingReward_userId_claimedAt_lostAt_expiresAt_idx" ON "PendingReward"("userId", "claimedAt", "lostAt", "expiresAt");

-- CreateIndex
CREATE INDEX "PendingReward_expiresAt_claimedAt_idx" ON "PendingReward"("expiresAt", "claimedAt");

-- CreateIndex
CREATE INDEX "PendingReward_kind_createdAt_idx" ON "PendingReward"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "PendingReward" ADD CONSTRAINT "PendingReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "coinTotal" INTEGER NOT NULL,
    "xpTotal" INTEGER NOT NULL DEFAULT 0,
    "consumedPendingIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Claim_userId_createdAt_idx" ON "Claim"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "XpBalance" (
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XpBalance_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "XpBalance" ADD CONSTRAINT "XpBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "XpTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRef" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "XpTransaction_idempotencyKey_key" ON "XpTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "XpTransaction_userId_createdAt_idx" ON "XpTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "XpTransaction_source_createdAt_idx" ON "XpTransaction"("source", "createdAt");

-- AddForeignKey
ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
