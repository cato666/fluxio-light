import { Module, forwardRef } from '@nestjs/common';
import { KapsoModule } from '../kapso/kapso.module';
import { MessageTemplatesModule } from '../message-templates/message-templates.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { StorageModule } from '../storage/storage.module';
import { QuotePdfService } from './quote-pdf.service';

@Module({
  imports: [forwardRef(() => KapsoModule), MessageTemplatesModule, StorageModule],
  controllers: [QuotesController],
  providers: [QuotesService, QuotePdfService],
  exports: [QuotesService]
})
export class QuotesModule {}
