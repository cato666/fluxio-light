import { Module } from '@nestjs/common';
import { KapsoModule } from '../kapso/kapso.module';
import { MessageTemplatesModule } from '../message-templates/message-templates.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [KapsoModule, MessageTemplatesModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService]
})
export class AppointmentsModule {}
