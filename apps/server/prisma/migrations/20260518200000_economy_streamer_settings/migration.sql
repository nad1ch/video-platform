-- Viewer Economy: per-streamer settings (toggles + caps). Safe defaults; a
-- missing row implies "use economyConfig" — operators never have to seed.

CREATE TABLE "StreamerEconomySettings" (
    "streamerId" TEXT NOT NULL,
    "chatRewardsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "predictionsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "caseDropsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxCoinsPerViewerPerStream" INTEGER NOT NULL DEFAULT 500,
    "maxPredictionStake" INTEGER NOT NULL DEFAULT 10000,
    "maxActivePredictions" INTEGER NOT NULL DEFAULT 3,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamerEconomySettings_pkey" PRIMARY KEY ("streamerId")
);
