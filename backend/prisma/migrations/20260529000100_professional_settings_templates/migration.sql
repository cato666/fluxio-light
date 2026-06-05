ALTER TABLE "Professional" ADD COLUMN "assistantAllowedPhones" TEXT;

CREATE TABLE "MessageTemplate" (
  "id" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageTemplate_professionalId_key_key" ON "MessageTemplate"("professionalId", "key");
CREATE INDEX "MessageTemplate_professionalId_active_idx" ON "MessageTemplate"("professionalId", "active");

ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
