import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { ContactsModule } from './contacts/contacts.module';
import { LeadsModule } from './leads/leads.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AttendancesModule } from './attendances/attendances.module';
import { IncomeModule } from './income/income.module';
import { ExpensesModule } from './expenses/expenses.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { KapsoModule } from './kapso/kapso.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { EvidenceModule } from './evidence/evidence.module';
import { StorageModule } from './storage/storage.module';
import { QuotesModule } from './quotes/quotes.module';
import { AuditModule } from './audit/audit.module';
import { MessageTemplatesModule } from './message-templates/message-templates.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { AdminNotificationsModule } from './admin-notifications/admin-notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AdminNotificationsModule,
    AuthModule,
    ProfessionalsModule,
    ContactsModule,
    LeadsModule,
    AppointmentsModule,
    AttendancesModule,
    IncomeModule,
    ExpensesModule,
    DashboardModule,
    KapsoModule,
    WhatsappModule,
    EvidenceModule,
    StorageModule,
    QuotesModule,
    AuditModule,
    MessageTemplatesModule,
    PlatformAdminModule
  ]
})
export class AppModule {}
