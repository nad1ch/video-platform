-- Viewer Economy: Case catalog (rarity tiers, weighted rewards, pity counter).
--
-- Additive. The legacy `CoinCase` table (per-user state for the six hub
-- cases) is unchanged; the open-case flow falls back to it when a slug is
-- not present in `CaseCatalog`. New cases are seeded by inserting into
-- `CaseCatalog` + `CaseReward`.

-- CreateTable
CREATE TABLE "CaseCatalog" (
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "rarityTier" TEXT NOT NULL DEFAULT 'common',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "guaranteedMinCoins" INTEGER NOT NULL DEFAULT 1,
    "pityFloorCount" INTEGER NOT NULL DEFAULT 10,
    "streamerId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseCatalog_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX "CaseCatalog_streamerId_idx" ON "CaseCatalog"("streamerId");
CREATE INDEX "CaseCatalog_isActive_idx" ON "CaseCatalog"("isActive");

-- CreateTable
CREATE TABLE "CaseReward" (
    "id" TEXT NOT NULL,
    "caseSlug" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "referenceId" TEXT,
    "minPityCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseReward_caseSlug_idx" ON "CaseReward"("caseSlug");

-- AddForeignKey
ALTER TABLE "CaseReward" ADD CONSTRAINT "CaseReward_caseSlug_fkey" FOREIGN KEY ("caseSlug") REFERENCES "CaseCatalog"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "UserCaseInventory" (
    "userId" TEXT NOT NULL,
    "caseSlug" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCaseInventory_pkey" PRIMARY KEY ("userId","caseSlug")
);

-- CreateIndex
CREATE INDEX "UserCaseInventory_userId_idx" ON "UserCaseInventory"("userId");

-- AddForeignKey
ALTER TABLE "UserCaseInventory" ADD CONSTRAINT "UserCaseInventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "UserPity" (
    "userId" TEXT NOT NULL,
    "caseSlug" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPity_pkey" PRIMARY KEY ("userId","caseSlug")
);

-- CreateIndex
CREATE INDEX "UserPity_userId_idx" ON "UserPity"("userId");

-- AddForeignKey
ALTER TABLE "UserPity" ADD CONSTRAINT "UserPity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CaseOpening" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseSlug" TEXT NOT NULL,
    "rewardId" TEXT,
    "rewardKind" TEXT NOT NULL,
    "rewardValue" INTEGER NOT NULL DEFAULT 0,
    "rewardReferenceId" TEXT,
    "coinTransactionId" TEXT,
    "xpTransactionId" TEXT,
    "pityCountBefore" INTEGER NOT NULL DEFAULT 0,
    "pityCountAfter" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseOpening_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseOpening_userId_createdAt_idx" ON "CaseOpening"("userId", "createdAt");
CREATE INDEX "CaseOpening_caseSlug_createdAt_idx" ON "CaseOpening"("caseSlug", "createdAt");

-- AddForeignKey
ALTER TABLE "CaseOpening" ADD CONSTRAINT "CaseOpening_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
