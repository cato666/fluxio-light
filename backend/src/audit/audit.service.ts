import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async list(professionalId: string, take = 100) {
    const safeTake = Math.min(Math.max(take || 100, 1), 200);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { professionalId },
          { professionalId: null }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: safeTake
    });

    return rows.map((row) => {
      const metadata = row.metadata as any;
      const payload = metadata?.payload || {};
      const data = Array.isArray(payload?.data) ? payload.data[0] : payload?.data || payload;
      const message = data?.message || data?.messages?.[0] || payload?.message;
      const result = metadata?.result || {};
      const headers = metadata?.headers || {};

      return {
        id: row.id,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        createdAt: row.createdAt,
        eventType: metadata?.eventType,
        idempotencyKey: metadata?.idempotencyKey || row.entityId,
        signatureChecked: metadata?.signatureChecked,
        payloadVersion: metadata?.payloadVersion,
        phoneNumberId: data?.phone_number_id || data?.metadata?.phone_number_id || message?.phone_number_id || payload?.phone_number_id,
        fromPhone: message?.from || data?.from || data?.contact?.wa_id || data?.conversation?.phone_number,
        text: message?.text?.body || message?.body || message?.kapso?.content || data?.text,
        messageType: message?.type || data?.type,
        result: {
          processed: result?.processed,
          reason: result?.reason,
          command: result?.command,
          commandChannel: result?.commandChannel,
          duplicate: result?.duplicate,
          quoteResponse: result?.quoteResponse,
          needsClarification: result?.needsClarification,
          media: result?.media,
          sent: result?.sent,
          status: result?.status
        },
        headers,
        raw: metadata
      };
    });
  }
}
