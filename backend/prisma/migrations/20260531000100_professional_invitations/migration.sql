CREATE TYPE "ProfessionalInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "ProfessionalInvitation" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "profession" TEXT,
  "phone" TEXT,
  "note" TEXT,
  "token" TEXT NOT NULL,
  "status" "ProfessionalInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "acceptedUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfessionalInvitation_token_key" ON "ProfessionalInvitation"("token");
CREATE INDEX "ProfessionalInvitation_email_idx" ON "ProfessionalInvitation"("email");
CREATE INDEX "ProfessionalInvitation_status_expiresAt_idx" ON "ProfessionalInvitation"("status", "expiresAt");

ALTER TABLE "ProfessionalInvitation" ADD CONSTRAINT "ProfessionalInvitation_acceptedUserId_fkey" FOREIGN KEY ("acceptedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
