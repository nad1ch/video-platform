-- Viewer Economy foundation: CoinTransaction ledger.
--
-- Adds an append-only ledger of every coin movement and backfills one
-- `migration_seed` row per pre-existing non-zero CoinBalance so the invariant
-- `sum(CoinTransaction.delta WHERE userId = X) == CoinBalance.amount` holds
-- from the moment the next CoinHub mutation executes.
--
-- Backfill is idempotent under accidental re-run via the
-- `migration_seed:<userId>` idempotency key (unique constraint enforces it).

-- CreateTable
CREATE TABLE "CoinTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRef" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoinTransaction_idempotencyKey_key" ON "CoinTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CoinTransaction_userId_createdAt_idx" ON "CoinTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CoinTransaction_source_createdAt_idx" ON "CoinTransaction"("source", "createdAt");

-- AddForeignKey
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one seed row per non-zero pre-existing CoinBalance. Users at 0
-- balance need no row (sum=0=balance already). Deterministic id and idempotency
-- key make this safe to re-run accidentally; the unique constraint on
-- idempotencyKey collapses duplicates.
INSERT INTO "CoinTransaction" (
  "id", "userId", "delta", "balanceBefore", "balanceAfter",
  "source", "sourceRef", "idempotencyKey", "metadata", "createdAt"
)
SELECT
  'seed_' || cb."userId",
  cb."userId",
  cb."amount",
  0,
  cb."amount",
  'migration_seed',
  NULL,
  'migration_seed:' || cb."userId",
  NULL,
  NOW()
FROM "CoinBalance" cb
WHERE cb."amount" > 0
ON CONFLICT ("idempotencyKey") DO NOTHING;
