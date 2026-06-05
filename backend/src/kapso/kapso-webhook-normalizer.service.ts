import { Injectable } from '@nestjs/common';
import { KapsoWebhookHeadersDto, NormalizedKapsoWebhookEvent } from './dto/kapso-webhook.dto';

@Injectable()
export class KapsoWebhookNormalizerService {
  normalize(payload: any, headers: KapsoWebhookHeadersDto): NormalizedKapsoWebhookEvent {
    const type = headers.eventType || payload?.event || payload?.type || payload?.name || this.inferEventType(payload);
    const data = Array.isArray(payload?.data) ? payload.data[0] : payload?.data || payload;
    const message = data?.message || data?.messages?.[0];
    const conversation = data?.conversation;
    const phoneNumberId =
      data?.phone_number_id ||
      conversation?.phone_number_id ||
      data?.metadata?.phone_number_id ||
      message?.phone_number_id;

    return {
      type,
      idempotencyKey: headers.idempotencyKey,
      payloadVersion: headers.payloadVersion,
      receivedAt: new Date().toISOString(),
      payload,
      data,
      message,
      conversation,
      phoneNumberId
    };
  }

  private inferEventType(payload: any) {
    const data = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
    const message = data?.message || payload?.message || payload?.messages?.[0];
    if (message?.kapso?.direction === 'inbound' || message?.from) return 'whatsapp.message.received';
    if (message?.kapso?.direction === 'outbound' || message?.to) return 'whatsapp.message.sent';
    if (payload?.phone_number_id && payload?.customer) return 'whatsapp.phone_number.created';
    return 'unknown';
  }
}
