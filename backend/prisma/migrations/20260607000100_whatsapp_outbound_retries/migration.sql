ALTER TABLE "WhatsAppMessage"
ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastRetryAt" TIMESTAMP(3),
ADD COLUMN "retryOfMessageId" TEXT;

CREATE INDEX "WhatsAppMessage_retryOfMessageId_idx" ON "WhatsAppMessage"("retryOfMessageId");

ALTER TABLE "WhatsAppMessage"
ADD CONSTRAINT "WhatsAppMessage_retryOfMessageId_fkey"
FOREIGN KEY ("retryOfMessageId") REFERENCES "WhatsAppMessage"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
