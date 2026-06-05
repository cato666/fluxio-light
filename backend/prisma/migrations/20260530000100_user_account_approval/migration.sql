CREATE TYPE "UserAccountStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED');

ALTER TABLE "User"
  ADD COLUMN "accountStatus" "UserAccountStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  ADD COLUMN "approvedAt" TIMESTAMP(3);

UPDATE "User"
SET "accountStatus" = 'ACTIVE',
    "approvedAt" = COALESCE("approvedAt", NOW());
