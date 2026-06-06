ALTER TABLE "Lead"
ADD COLUMN "closedReason" TEXT,
ADD COLUMN "closedAt" TIMESTAMP(3);

ALTER TABLE "Attendance"
ADD COLUMN "appointmentId" TEXT;

CREATE UNIQUE INDEX "Attendance_appointmentId_key" ON "Attendance"("appointmentId");

ALTER TABLE "Attendance"
ADD CONSTRAINT "Attendance_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
