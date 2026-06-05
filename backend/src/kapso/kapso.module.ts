import { Module, forwardRef } from '@nestjs/common';
import { KapsoController } from './kapso.controller';
import { KapsoWebhookController } from './kapso-webhook.controller';
import { KapsoConfigService } from './kapso-config.service';
import { KapsoPlatformClient } from './kapso-platform.client';
import { KapsoService } from './kapso.service';
import { KapsoWebhookNormalizerService } from './kapso-webhook-normalizer.service';
import { KapsoWebhookSignatureService } from './kapso-webhook-signature.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [forwardRef(() => WhatsappModule)],
  controllers: [KapsoController, KapsoWebhookController],
  providers: [KapsoConfigService, KapsoPlatformClient, KapsoWebhookNormalizerService, KapsoWebhookSignatureService, KapsoService],
  exports: [KapsoConfigService, KapsoService]
})
export class KapsoModule {}
