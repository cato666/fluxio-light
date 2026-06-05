import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { KapsoModule } from '../kapso/kapso.module';

@Module({
  imports: [KapsoModule],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService]
})
export class LeadsModule {}
