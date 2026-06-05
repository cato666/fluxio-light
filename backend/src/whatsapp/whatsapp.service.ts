import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { KapsoService } from '../kapso/kapso.service';

@Injectable()
export class WhatsappService {
  constructor(private prisma: PrismaService, private kapso: KapsoService) {}

  async listConversations(professionalId: string) {
    const conversations = await this.prisma.whatsAppConversation.findMany({
      where: { professionalId },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        evidenceFiles: {
          orderBy: { createdAt: 'desc' },
          take: 3
        }
      }
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      contactName: conversation.contactName,
      contactPhone: conversation.contactPhone,
      kapsoConversationId: conversation.kapsoConversationId,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessage: conversation.messages[0] || null,
      evidenceCount: conversation.evidenceFiles.length
    }));
  }

  async getConversation(professionalId: string, id: string) {
    const conversation = await this.prisma.whatsAppConversation.findFirst({
      where: { id, professionalId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            evidenceFiles: {
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        evidenceFiles: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!conversation) {
      throw new NotFoundException('WhatsApp conversation not found.');
    }

    return conversation;
  }

  async reply(professionalId: string, id: string, body: string) {
    const text = body?.trim();
    if (!text) throw new BadRequestException('Reply body is required.');

    const conversation = await this.prisma.whatsAppConversation.findFirst({
      where: { id, professionalId },
      include: { connection: true }
    });

    if (!conversation) throw new NotFoundException('WhatsApp conversation not found.');
    if (!conversation.contactPhone) throw new BadRequestException('Conversation contact phone is required.');

    const connection = conversation.connection || await this.prisma.whatsAppConnection.findFirst({
      where: {
        professionalId,
        phoneNumberId: { not: null },
        status: { in: ['connected', 'CONNECTED'] }
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (!connection?.phoneNumberId) {
      throw new BadRequestException('No connected WhatsApp connection is available.');
    }

    let sendResult: any;
    try {
      sendResult = await this.kapso.sendTrackedTextMessage({
        professionalId,
        conversationId: conversation.id,
        phoneNumberId: connection.phoneNumberId,
        fromPhone: connection.displayPhone || connection.phoneNumberId,
        to: conversation.contactPhone,
        body: text,
        source: 'manual_reply'
      });
    } catch (error) {
      await this.prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() }
      });
      throw error;
    }

    await this.prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() }
    });

    return {
      ok: true,
      simulated: Boolean(sendResult?.simulated),
      messageId: sendResult.messageId,
      outboundStatus: sendResult.message?.outboundStatus
    };
  }
}
