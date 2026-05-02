-- Billing (StreamAssist Pro) — monobank Jar/Banka manual link + Personal API matching.
--
-- Tables:
--   PaymentRequest   — per-user payment intent; activation only via `auto_matched` (matcher) or `approved` (admin).
--   MonoTransaction  — idempotent mirror of monobank Personal StatementItem (webhook + polling sources).
--   Subscription    — single Pro window per user; `expiresAt > now()` is the source of truth for "is Pro now".
--
-- Idempotency invariants enforced by SQL:
--   - `MonoTransaction.monoTransactionId` UNIQUE — duplicate webhooks/polling never insert twice.
--   - `PaymentRequest.matchedTransactionId` UNIQUE — a transaction can never be attached to two requests.
--   - `Subscription.userId` UNIQUE — one row per user; activation upserts.

CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mono_jar',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting_payment',
    "internalReference" TEXT,
    "adminNote" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "markedPaidAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3),
    "autoMatchedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "matchedTransactionId" TEXT,
    "autoMatchedEmailSentAt" TIMESTAMP(3),
    "needsReviewEmailSentAt" TIMESTAMP(3),
    "approvedEmailSentAt" TIMESTAMP(3),
    "rejectedEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRequest_internalReference_key" ON "PaymentRequest"("internalReference");
CREATE UNIQUE INDEX "PaymentRequest_matchedTransactionId_key" ON "PaymentRequest"("matchedTransactionId");
CREATE INDEX "PaymentRequest_userId_status_idx" ON "PaymentRequest"("userId", "status");
CREATE INDEX "PaymentRequest_status_expiresAt_idx" ON "PaymentRequest"("status", "expiresAt");
CREATE INDEX "PaymentRequest_amount_currency_status_idx" ON "PaymentRequest"("amount", "currency", "status");
CREATE INDEX "PaymentRequest_createdAt_idx" ON "PaymentRequest"("createdAt");

ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MonoTransaction" (
    "id" TEXT NOT NULL,
    "monoTransactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT,
    "operationTime" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "matchedPaymentRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonoTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonoTransaction_monoTransactionId_key" ON "MonoTransaction"("monoTransactionId");
CREATE INDEX "MonoTransaction_accountId_operationTime_idx" ON "MonoTransaction"("accountId", "operationTime");
CREATE INDEX "MonoTransaction_matchedPaymentRequestId_idx" ON "MonoTransaction"("matchedPaymentRequestId");
CREATE INDEX "MonoTransaction_amount_currency_direction_idx" ON "MonoTransaction"("amount", "currency", "direction");

-- Cross-table FK from PaymentRequest.matchedTransactionId → MonoTransaction.id (added after both tables exist).
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_matchedTransactionId_fkey" FOREIGN KEY ("matchedTransactionId") REFERENCES "MonoTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
CREATE INDEX "Subscription_expiresAt_idx" ON "Subscription"("expiresAt");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
