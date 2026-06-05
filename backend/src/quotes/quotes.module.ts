import { Module } from '@nestjs/common';
import { KapsoModule } from '../kapso/kapso.module';
import { MessageTemplatesModule } from '../message-templates/message-templates.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [KapsoModule, MessageTemplatesModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService]
})
export class QuotesModule {}
