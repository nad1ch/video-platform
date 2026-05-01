-- Store Twitch streamer profile metadata resolved during OAuth login.
ALTER TABLE "Streamer" ADD COLUMN "displayName" TEXT;
ALTER TABLE "Streamer" ADD COLUMN "profileImageUrl" TEXT;
ALTER TABLE "Streamer" ADD COLUMN "broadcasterType" TEXT;
ALTER TABLE "Streamer" ADD COLUMN "followersCount" INTEGER;
ALTER TABLE "Streamer" ADD COLUMN "currentOnline" INTEGER;
ALTER TABLE "Streamer" ADD COLUMN "avgOnline7d" INTEGER;
ALTER TABLE "Streamer" ADD COLUMN "isLive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Streamer" ADD COLUMN "lastSyncAt" TIMESTAMP(3);
ALTER TABLE "Streamer" ADD COLUMN "tier" TEXT;

-- Explicit owner membership. Existing ownerId stays for compatibility with current Nadle/Nadraw guards.
CREATE TABLE "StreamerMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamerMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StreamerMember_userId_streamerId_key" ON "StreamerMember"("userId", "streamerId");
CREATE INDEX "StreamerMember_streamerId_role_idx" ON "StreamerMember"("streamerId", "role");

ALTER TABLE "StreamerMember" ADD CONSTRAINT "StreamerMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StreamerMember" ADD CONSTRAINT "StreamerMember_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "StreamerMember" ("id", "userId", "streamerId", "role", "createdAt", "updatedAt")
SELECT concat('sm_', md5("ownerId" || ':' || "id")), "ownerId", "id", 'OWNER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Streamer"
WHERE "ownerId" IS NOT NULL
ON CONFLICT ("userId", "streamerId") DO NOTHING;
