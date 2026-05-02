-- Billing email + subscription-lifecycle email idempotency.
--
-- Adds:
--   User.billingEmail              — optional notification address. Falls back to `email` when null.
--                                    Lets Twitch sign-ups without auth email still receive billing
--                                    confirmations.
--   Subscription.cancelledEmailSentAt — single-flight claim for the user-facing "Pro доступ скасовано"
--                                       email; idempotent across repeated admin cancels.
--   Subscription.expiredEmailSentAt   — single-flight claim for the user-facing "Pro період закінчився"
--                                       email; set lazily on read in getSubscriptionDtoForUser.

ALTER TABLE "User" ADD COLUMN "billingEmail" TEXT;

ALTER TABLE "Subscription" ADD COLUMN "cancelledEmailSentAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "expiredEmailSentAt" TIMESTAMP(3);
