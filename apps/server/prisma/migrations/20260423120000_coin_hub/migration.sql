-- Coin Hub: balance, pending, daily spin, per-user case slots.
CREATE TABLE "CoinBalance" (
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinBalance_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "Pending" (
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pending_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "Spin" (
    "userId" TEXT NOT NULL,
    "nextAvailableAt" TIMESTAMP(3),
    "lastReward" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spin_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "CoinCase" (
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "cooldownUntil" TIMESTAMP(3),
    "lastReward" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinCase_pkey" PRIMARY KEY ("userId","caseId")
);

CREATE INDEX "CoinCase_userId_idx" ON "CoinCase"("userId");

ALTER TABLE "CoinBalance" ADD CONSTRAINT "CoinBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pending" ADD CONSTRAINT "Pending_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Spin" ADD CONSTRAINT "Spin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoinCase" ADD CONSTRAINT "CoinCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
