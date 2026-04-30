-- Durable live game snapshots for restart-safe restore.

CREATE TABLE "NadleLiveGame" (
    "streamerId" TEXT NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NadleLiveGame_pkey" PRIMARY KEY ("streamerId")
);

CREATE TABLE "CheckersLiveRoom" (
    "roomId" TEXT NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckersLiveRoom_pkey" PRIMARY KEY ("roomId")
);

CREATE TABLE "NadrawLiveRoom" (
    "streamerId" TEXT NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NadrawLiveRoom_pkey" PRIMARY KEY ("streamerId")
);

ALTER TABLE "NadleLiveGame" ADD CONSTRAINT "NadleLiveGame_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NadrawLiveRoom" ADD CONSTRAINT "NadrawLiveRoom_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
