CREATE TABLE "UserActivityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "event" TEXT NOT NULL,
    "path" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivityEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientErrorEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "path" TEXT,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientErrorEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserActivityEvent_userId_createdAt_idx" ON "UserActivityEvent"("userId", "createdAt");
CREATE INDEX "UserActivityEvent_event_createdAt_idx" ON "UserActivityEvent"("event", "createdAt");
CREATE INDEX "UserActivityEvent_createdAt_idx" ON "UserActivityEvent"("createdAt");

CREATE INDEX "ClientErrorEvent_userId_createdAt_idx" ON "ClientErrorEvent"("userId", "createdAt");
CREATE INDEX "ClientErrorEvent_source_createdAt_idx" ON "ClientErrorEvent"("source", "createdAt");
CREATE INDEX "ClientErrorEvent_createdAt_idx" ON "ClientErrorEvent"("createdAt");

ALTER TABLE "UserActivityEvent" ADD CONSTRAINT "UserActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientErrorEvent" ADD CONSTRAINT "ClientErrorEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
