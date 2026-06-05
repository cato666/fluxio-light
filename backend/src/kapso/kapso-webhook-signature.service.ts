import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { KapsoConfigService } from './kapso-config.service';

@Injectable()
export class KapsoWebhookSignatureService {
  constructor(private readonly kapsoConfig: KapsoConfigService) {}

  verify(payload: any, signature?: string) {
    if (!this.kapsoConfig.isWebhookConfigured) {
      return { checked: false, valid: true };
    }

    if (!signature) {
      throw new UnauthorizedException('Missing Kapso webhook signature.');
    }

    const expected = createHmac('sha256', this.kapsoConfig.webhookSecret!)
      .update(JSON.stringify(payload))
      .digest('hex');

    const normalizedSignature = signature.replace(/^sha256=/i, '').trim();
    const expectedBuffer = Buffer.from(expected, 'hex');
    const actualBuffer = Buffer.from(normalizedSignature, 'hex');

    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Invalid Kapso webhook signature.');
    }

    return { checked: true, valid: true };
  }
}
