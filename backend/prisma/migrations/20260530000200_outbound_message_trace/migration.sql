ALTER TABLE "WhatsAppMessage"
  ADD COLUMN "outboundStatus" TEXT,
  ADD COLUMN "outboundSource" TEXT,
  ADD COLUMN "outboundError" TEXT,
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "readAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3);

CREATE INDEX "WhatsAppMessage_professionalId_direction_outboundStatus_idx"
  ON "WhatsAppMessage"("professionalId", "direction", "outboundStatus");

CREATE INDEX "WhatsAppMessage_kapsoMessageId_idx"
  ON "WhatsAppMessage"("kapsoMessageId");

UPDATE "WhatsAppMessage"
SET
  "outboundStatus" = CASE
    WHEN "payload"->>'error' IS NOT NULL THEN 'FAILED'
    WHEN "payload"->'kapso'->>'simulated' = 'true' THEN 'SIMULATED'
    ELSE 'SENT'
  END,
  "outboundSource" = COALESCE("payload"->>'source', 'legacy'),
  "sentAt" = CASE
    WHEN "payload"->>'error' IS NULL THEN "createdAt"
    ELSE NULL
  END,
  "failedAt" = CASE
    WHEN "payload"->>'error' IS NOT NULL THEN "createdAt"
    ELSE NULL
  END,
  "outboundError" = "payload"->>'error'
WHERE "direction" = 'OUTBOUND' AND "outboundStatus" IS NULL;
