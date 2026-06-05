CREATE TABLE "AssistantPendingAction" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "fromPhone" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantPendingAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantPendingAction_professionalId_fromPhone_idx" ON "AssistantPendingAction"("professionalId", "fromPhone");
CREATE INDEX "AssistantPendingAction_expiresAt_idx" ON "AssistantPendingAction"("expiresAt");

ALTER TABLE "AssistantPendingAction" ADD CONSTRAINT "AssistantPendingAction_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
