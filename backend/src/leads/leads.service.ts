import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { KapsoService } from '../kapso/kapso.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { SendQuoteDto } from './dto/send-quote.dto';
import { CreateAttendanceFromLeadDto } from './dto/create-attendance-from-lead.dto';
import { CloseLeadDto } from './dto/close-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService, private kapso: KapsoService) {}

  list(professionalId: string) {
    return this.prisma.lead.findMany({
      where: { professionalId },
      orderBy: { createdAt: 'desc' },
      include: {
        contact: true
      }
    });
  }

  get(professionalId: string, id: string) {
    return this.prisma.lead.findFirst({
      where: { id, professionalId },
      include: {
        contact: true
      }
    });
  }

  create(professionalId: string, dto: CreateLeadDto) {
    return this.prisma.lead.create({
      data: { ...dto, professionalId } as any
    });
  }

  async update(professionalId: string, id: string, dto: Partial<CreateLeadDto> & any) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, professionalId },
      include: { contact: true }
    });

    if (!lead) throw new NotFoundException('Lead not found.');

    const { contactName, contactPhone, contactEmail, contactNotes, ...leadData } = dto;

    let contactId = lead.contactId;
    const shouldUpdateContact =
      contactName !== undefined ||
      contactPhone !== undefined ||
      contactEmail !== undefined ||
      contactNotes !== undefined;

    if (shouldUpdateContact) {
      if (contactId) {
        await this.prisma.contact.update({
          where: { id: contactId },
          data: {
            fullName: contactName,
            phone: contactPhone,
            email: contactEmail,
            notes: contactNotes
          }
        });
      } else {
        const contact = await this.prisma.contact.create({
          data: {
            professionalId,
            fullName: contactName,
            phone: contactPhone,
            email: contactEmail,
            notes: contactNotes,
            source: lead.source || 'WhatsApp'
          }
        });
        contactId = contact.id;
      }
    }

    return this.prisma.lead.update({
      where: { id: lead.id },
      data: { ...leadData, contactId } as any,
      include: { contact: true }
    });
  }

  async close(professionalId: string, id: string, dto: CloseLeadDto) {
    if (!['WON', 'LOST'].includes(dto.status)) {
      throw new BadRequestException('Lead can only be closed as WON or LOST.');
    }
    if (!dto.reason.trim()) {
      throw new BadRequestException('Closing reason is required.');
    }
    const lead = await this.prisma.lead.findFirst({ where: { id, professionalId } });
    if (!lead) throw new NotFoundException('Lead not found.');

    return this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: dto.status,
        closedReason: dto.reason.trim(),
        closedAt: new Date()
      },
      include: { contact: true }
    });
  }

  async sendQuote(professionalId: string, id: string, dto: SendQuoteDto) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, professionalId },
      include: { contact: true }
    });

    if (!lead) throw new NotFoundException('Lead not found.');
    if (!lead.contact?.phone) throw new BadRequestException('Lead contact phone is required before sending a quote.');

    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: {
        professionalId,
        phoneNumberId: { not: null },
        status: { in: ['connected', 'CONNECTED'] }
      },
      orderBy: [{ connectionType: 'desc' }, { updatedAt: 'desc' }]
    });

    if (!connection?.phoneNumberId) {
      throw new BadRequestException('No connected WhatsApp connection is available.');
    }

    const message = dto.message || this.buildQuoteMessage(lead);
    const quote = await this.prisma.quote.create({
      data: {
        professionalId,
        contactId: lead.contactId,
        leadId: lead.id,
        title: lead.title,
        description: lead.description,
        amount: lead.estimatedValue || 0,
        status: 'PENDING_CONFIRMATION',
        message
      }
    });

    const existingConversation = await this.prisma.whatsAppConversation.findFirst({
      where: { professionalId, contactPhone: lead.contact.phone }
    });

    const conversation = existingConversation
      ? await this.prisma.whatsAppConversation.update({
        where: { id: existingConversation.id },
        data: {
          contactName: lead.contact.fullName,
          lastMessageAt: new Date()
        }
      })
      : await this.prisma.whatsAppConversation.create({
        data: {
          professionalId,
          connectionId: connection.id,
          contactPhone: lead.contact!.phone!,
          contactName: lead.contact!.fullName,
          lastMessageAt: new Date()
        }
      });

    let sendResult: any;
    try {
      sendResult = await this.kapso.sendTrackedTextMessage({
        professionalId,
        conversationId: conversation.id,
        phoneNumberId: connection.phoneNumberId,
        fromPhone: connection.displayPhone || connection.phoneNumberId,
        to: lead.contact.phone,
        body: message,
        source: 'quote',
        metadata: {
          quoteId: quote.id,
          leadId: lead.id
        }
      });
    } catch (error) {
      await this.prisma.quote.update({
        where: { id: quote.id },
        data: { status: 'FAILED' }
      });
      throw error;
    }

    await this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: 'SENT',
        sentAt: new Date()
      }
    });

    return {
      ok: true,
      simulated: Boolean(sendResult?.simulated),
      message,
      quoteId: quote.id,
      messageId: sendResult.messageId,
      conversationId: conversation.id
    };
  }

  async createAttendanceFromLead(professionalId: string, id: string, dto: CreateAttendanceFromLeadDto) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, professionalId },
      include: { contact: true }
    });

    if (!lead) throw new NotFoundException('Lead not found.');

    const amount = dto.amount ?? lead.estimatedValue ?? 0;
    const title = dto.title || lead.title;
    const description = dto.description || lead.description || `Atencion creada desde lead ${lead.title}`;
    const paymentStatus = dto.paymentStatus || 'PENDING';
    const paymentMethod = dto.paymentMethod || 'OTHER';

    return this.prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.create({
        data: {
          professionalId,
          contactId: lead.contactId,
          title,
          description,
          amount
        }
      });

      const incomeRecord = await tx.incomeRecord.create({
        data: {
          professionalId,
          contactId: lead.contactId,
          attendanceId: attendance.id,
          description: title,
          amount,
          paymentStatus,
          paymentMethod,
          paidAt: paymentStatus === 'PENDING' ? null : new Date()
        }
      });

      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: 'WON',
          estimatedValue: amount,
          closedReason: 'Atencion creada desde lead',
          closedAt: new Date()
        },
        include: { contact: true }
      });

      return {
        lead: updatedLead,
        attendance: await tx.attendance.findUnique({
          where: { id: attendance.id },
          include: { contact: true, incomeRecord: true }
        }),
        incomeRecord
      };
    });
  }

  remove(professionalId: string, id: string) {
    return this.prisma.lead.deleteMany({ where: { id, professionalId } });
  }

  private buildQuoteMessage(lead: any) {
    const name = lead.contact?.fullName || 'gracias por contactarnos';
    const amount = lead.estimatedValue ? `$${Number(lead.estimatedValue).toLocaleString('es-CL')}` : 'por confirmar';

    return [
      `Hola ${name}, gracias por contactarnos.`,
      '',
      'Cotizacion:',
      `Servicio: ${lead.title}`,
      lead.description ? `Detalle: ${lead.description}` : null,
      `Valor estimado: ${amount}`,
      '',
      'Si estas de acuerdo, responde "acepto" y coordinamos la atencion.'
    ].filter(Boolean).join('\n');
  }
}
