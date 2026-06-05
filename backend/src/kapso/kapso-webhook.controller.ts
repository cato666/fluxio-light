import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { WhatsappRouterService } from '../whatsapp/whatsapp-router.service';
import { KapsoWebhookNormalizerService } from './kapso-webhook-normalizer.service';
import { KapsoWebhookSignatureService } from './kapso-webhook-signature.service';
import { KapsoWebhookHeadersDto } from './dto/kapso-webhook.dto';

@Controller('kapso')
export class KapsoWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: WhatsappRouterService,
    private readonly normalizer: KapsoWebhookNormalizerService,
    private readonly signature: KapsoWebhookSignatureService
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() body: any, @Headers() headers: any) {
    const kapsoHeaders = this.mapHeaders(headers);
    const signatureResult = this.signature.verify(body, kapsoHeaders.signature);
    const normalized = this.normalizer.normalize(body, kapsoHeaders);

    const auditLog = await this.prisma.auditLog.create({
      data: {
        action: 'KAPSO_WEBHOOK_RECEIVED',
        entity: 'KapsoWebhook',
        entityId: normalized.idempotencyKey,
        metadata: {
          eventType: normalized.type,
          idempotencyKey: normalized.idempotencyKey,
          payloadVersion: normalized.payloadVersion,
          signatureChecked: signatureResult.checked,
          headers: { ...kapsoHeaders },
          payload: body
        }
      }
    });

    const result = await this.router.handleKapsoEvent(normalized, kapsoHeaders);
    await this.prisma.auditLog.update({
      where: { id: auditLog.id },
      data: {
        professionalId: (result as any)?.professionalId || null,
        metadata: {
          ...(auditLog.metadata as any),
          result
        }
      }
    });

    return { ok: true, eventType: normalized.type, idempotencyKey: normalized.idempotencyKey, result };
  }

  private mapHeaders(headers: Record<string, string | string[] | undefined>): KapsoWebhookHeadersDto {
    return {
      eventType: this.header(headers, 'x-webhook-event'),
      signature: this.header(headers, 'x-webhook-signature'),
      idempotencyKey: this.header(headers, 'x-idempotency-key'),
      payloadVersion: this.header(headers, 'x-webhook-payload-version'),
      batch: this.header(headers, 'x-webhook-batch'),
      batchSize: this.header(headers, 'x-batch-size')
    };
  }

  private header(headers: Record<string, string | string[] | undefined>, name: string) {
    const value = headers[name] || headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }
}
