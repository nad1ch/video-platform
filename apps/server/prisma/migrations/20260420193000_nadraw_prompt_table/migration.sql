-- Rename drawing-game prompts table to match current product naming.
ALTER TABLE "GarticPrompt" RENAME TO "NadrawPrompt";

ALTER TABLE "NadrawPrompt" RENAME CONSTRAINT "GarticPrompt_pkey" TO "NadrawPrompt_pkey";
ALTER TABLE "NadrawPrompt" RENAME CONSTRAINT "GarticPrompt_streamerId_fkey" TO "NadrawPrompt_streamerId_fkey";

ALTER INDEX "GarticPrompt_streamerId_approved_idx" RENAME TO "NadrawPrompt_streamerId_approved_idx";
ALTER INDEX "GarticPrompt_streamerId_normalizedText_idx" RENAME TO "NadrawPrompt_streamerId_normalizedText_idx";
