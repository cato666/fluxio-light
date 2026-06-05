import { Module, forwardRef } from '@nestjs/common';
import { WhatsappRouterService } from './whatsapp-router.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { WhatsappCommandParserService } from './whatsapp-command-parser.service';
import { WhatsappMediaService } from './whatsapp-media.service';
import { WhatsappResponseBuilderService } from './whatsapp-response-builder.service';
import { KapsoModule } from '../kapso/kapso.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { StorageModule } from '../storage/storage.module';
import { MessageTemplatesModule } from '../message-templates/message-templates.module';

@Module({
  imports: [forwardRef(() => KapsoModule), EvidenceModule, StorageModule, MessageTemplatesModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappRouterService, WhatsappCommandParserService, WhatsappMediaService, WhatsappResponseBuilderService],
  exports: [WhatsappRouterService, WhatsappService]
})
export class WhatsappModule {}
