ALTER TABLE "Quote"
ADD COLUMN "validityDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN "paymentTerms" TEXT,
ADD COLUMN "observations" TEXT;

CREATE TABLE "QuoteDocument" (
  "id" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
  "storageProvider" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "publicUrl" TEXT,
  "snapshot" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentToClientAt" TIMESTAMP(3),
  "sentToProfessionalAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "QuoteDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuoteDocument_quoteId_version_key" ON "QuoteDocument"("quoteId", "version");
CREATE INDEX "QuoteDocument_professionalId_quoteId_idx" ON "QuoteDocument"("professionalId", "quoteId");

ALTER TABLE "QuoteDocument"
ADD CONSTRAINT "QuoteDocument_professionalId_fkey"
FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QuoteDocument"
ADD CONSTRAINT "QuoteDocument_quoteId_fkey"
FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
