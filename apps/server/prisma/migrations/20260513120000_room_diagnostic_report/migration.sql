-- CreateTable
CREATE TABLE "RoomDiagnosticReport" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "gameType" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "eventCount" INTEGER NOT NULL,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "hasErrors" BOOLEAN NOT NULL DEFAULT false,
    "hasWarnings" BOOLEAN NOT NULL DEFAULT false,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "hostUserId" TEXT,
    "hostDisplayName" TEXT,
    "participantCount" INTEGER,
    "finalizedReason" TEXT,
    "reportJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomDiagnosticReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomDiagnosticReport_createdAt_idx" ON "RoomDiagnosticReport"("createdAt");

-- CreateIndex
CREATE INDEX "RoomDiagnosticReport_roomId_createdAt_idx" ON "RoomDiagnosticReport"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "RoomDiagnosticReport_gameType_createdAt_idx" ON "RoomDiagnosticReport"("gameType", "createdAt");

-- CreateIndex
CREATE INDEX "RoomDiagnosticReport_hasErrors_createdAt_idx" ON "RoomDiagnosticReport"("hasErrors", "createdAt");
