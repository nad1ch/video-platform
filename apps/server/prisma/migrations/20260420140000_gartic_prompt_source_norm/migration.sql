-- AlterTable
ALTER TABLE "GarticPrompt" ADD COLUMN     "normalizedText" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'chat';

-- CreateIndex
CREATE INDEX "GarticPrompt_streamerId_normalizedText_idx" ON "GarticPrompt"("streamerId", "normalizedText");
