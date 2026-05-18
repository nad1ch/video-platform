-- Viewer Economy: internal-only predictions (Twitch-style) with pool-based
-- payouts. Coins staked are viewer-earned only — never real money.

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "lockAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "winningOptionId" TEXT,
    "minStake" INTEGER NOT NULL,
    "maxStake" INTEGER NOT NULL,
    "totalPool" INTEGER NOT NULL DEFAULT 0,
    "totalPaidOut" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prediction_streamerId_status_idx" ON "Prediction"("streamerId", "status");
CREATE INDEX "Prediction_status_lockAt_idx" ON "Prediction"("status", "lockAt");

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PredictionOption" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "totalStakes" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PredictionOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PredictionOption_predictionId_idx" ON "PredictionOption"("predictionId");

-- AddForeignKey
ALTER TABLE "PredictionOption" ADD CONSTRAINT "PredictionOption_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PredictionEntry" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stake" INTEGER NOT NULL,
    "payout" INTEGER NOT NULL DEFAULT 0,
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "stakeCoinTransactionId" TEXT,
    "payoutPendingRewardId" TEXT,
    "refundCoinTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PredictionEntry_predictionId_userId_key" ON "PredictionEntry"("predictionId", "userId");
CREATE UNIQUE INDEX "PredictionEntry_stakeCoinTransactionId_key" ON "PredictionEntry"("stakeCoinTransactionId");
CREATE UNIQUE INDEX "PredictionEntry_payoutPendingRewardId_key" ON "PredictionEntry"("payoutPendingRewardId");
CREATE UNIQUE INDEX "PredictionEntry_refundCoinTransactionId_key" ON "PredictionEntry"("refundCoinTransactionId");
CREATE INDEX "PredictionEntry_optionId_idx" ON "PredictionEntry"("optionId");
CREATE INDEX "PredictionEntry_userId_idx" ON "PredictionEntry"("userId");

-- AddForeignKey
ALTER TABLE "PredictionEntry" ADD CONSTRAINT "PredictionEntry_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PredictionEntry" ADD CONSTRAINT "PredictionEntry_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PredictionOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PredictionEntry" ADD CONSTRAINT "PredictionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
