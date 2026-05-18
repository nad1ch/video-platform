-- Audit P2 / Batch G: durable inbox for monobank webhook deliveries.
-- The webhook handler inserts the raw payload BEFORE invoking the matcher
-- so a downstream throw (DB blip, parse drift) does not lose the event.
-- Idempotency at the activation layer is provided by `MonoTransaction`
-- (`monoTransactionId @unique`); double-processing one inbox row is safe.

-- CreateTable
CREATE TABLE "MonoWebhookInbox" (
    "id" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "MonoWebhookInbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonoWebhookInbox_processedAt_receivedAt_idx" ON "MonoWebhookInbox"("processedAt", "receivedAt");
