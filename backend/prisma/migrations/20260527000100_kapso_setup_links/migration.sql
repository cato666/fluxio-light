ALTER TABLE "Professional" ADD COLUMN "kapsoCustomerId" TEXT;

ALTER TABLE "WhatsAppConnection"
ADD COLUMN "setupLinkId" TEXT,
ADD COLUMN "setupLinkUrl" TEXT,
ADD COLUMN "setupLinkExpiresAt" TIMESTAMP(3),
ADD COLUMN "setupLinkStatus" TEXT,
ADD COLUMN "lastError" TEXT;

CREATE UNIQUE INDEX "Professional_kapsoCustomerId_key" ON "Professional"("kapsoCustomerId");
CREATE UNIQUE INDEX "WhatsAppConnection_setupLinkId_key" ON "WhatsAppConnection"("setupLinkId");
