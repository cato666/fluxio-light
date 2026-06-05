CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'PENDING_CONFIRMATION', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED', 'FAILED', 'CANCELLED');

CREATE TABLE "Quote" (
  "id" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "contactId" TEXT,
  "leadId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
  "message" TEXT,
  "sentAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Attendance" ADD COLUMN "quoteId" TEXT;

CREATE UNIQUE INDEX "Attendance_quoteId_key" ON "Attendance"("quoteId");
CREATE INDEX "Quote_professionalId_status_idx" ON "Quote"("professionalId", "status");
CREATE INDEX "Quote_professionalId_contactId_idx" ON "Quote"("professionalId", "contactId");
CREATE INDEX "Quote_professionalId_leadId_idx" ON "Quote"("professionalId", "leadId");

ALTER TABLE "Quote" ADD CONSTRAINT "Quote_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
