ALTER TABLE "Expense" ADD COLUMN "attendanceId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "contactId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "leadId" TEXT;

CREATE INDEX "Expense_professionalId_attendanceId_idx" ON "Expense"("professionalId", "attendanceId");
CREATE INDEX "Expense_professionalId_contactId_idx" ON "Expense"("professionalId", "contactId");
CREATE INDEX "Expense_professionalId_leadId_idx" ON "Expense"("professionalId", "leadId");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
