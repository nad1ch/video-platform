-- Viewer Economy: badges + cosmetics inventory backend (no UI yet).

-- CreateTable
CREATE TABLE "Badge" (
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "iconUrl" TEXT,
    "rarityTier" TEXT NOT NULL DEFAULT 'common',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "userId" TEXT NOT NULL,
    "badgeSlug" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("userId","badgeSlug")
);

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeSlug_fkey" FOREIGN KEY ("badgeSlug") REFERENCES "Badge"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Cosmetic" (
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "rarityTier" TEXT NOT NULL DEFAULT 'common',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cosmetic_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "UserCosmetic" (
    "userId" TEXT NOT NULL,
    "cosmeticSlug" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCosmetic_pkey" PRIMARY KEY ("userId","cosmeticSlug")
);

-- CreateIndex
CREATE INDEX "UserCosmetic_userId_idx" ON "UserCosmetic"("userId");

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_cosmeticSlug_fkey" FOREIGN KEY ("cosmeticSlug") REFERENCES "Cosmetic"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "EquippedCosmetic" (
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "cosmeticSlug" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquippedCosmetic_pkey" PRIMARY KEY ("userId","kind")
);

-- CreateIndex
CREATE INDEX "EquippedCosmetic_userId_idx" ON "EquippedCosmetic"("userId");
CREATE INDEX "EquippedCosmetic_cosmeticSlug_idx" ON "EquippedCosmetic"("cosmeticSlug");

-- AddForeignKey
ALTER TABLE "EquippedCosmetic" ADD CONSTRAINT "EquippedCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquippedCosmetic" ADD CONSTRAINT "EquippedCosmetic_cosmeticSlug_fkey" FOREIGN KEY ("cosmeticSlug") REFERENCES "Cosmetic"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
