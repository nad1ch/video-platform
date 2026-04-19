-- CreateTable
CREATE TABLE "GarticPrompt" (
    "id" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdBy" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarticPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GarticPrompt_streamerId_approved_idx" ON "GarticPrompt"("streamerId", "approved");

-- AddForeignKey
ALTER TABLE "GarticPrompt" ADD CONSTRAINT "GarticPrompt_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
