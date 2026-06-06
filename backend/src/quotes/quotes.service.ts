import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { QuoteStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { KapsoService } from '../kapso/kapso.service';
import { MessageTemplatesService } from '../message-templates/message-templates.service';
import { CreateAttendanceFromQuoteDto } from './dto/create-attendance-from-quote.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { QuoteDocumentRecipient } from './dto/send-quote-document.dto';
import { QuotePdfService } from './quote-pdf.service';

@Injectable()
export class QuotesService {
  constructor(
    private prisma: PrismaService,
    private kapso: KapsoService,
    private templates: MessageTemplatesService,
    private quotePdf: QuotePdfService
  ) {}

  list(professionalId: string) {
    return this.prisma.quote.findMany({
      where: { professionalId },
      orderBy: { createdAt: 'desc' },
      include: { contact: true, lead: true, attendance: true, documents: { orderBy: { version: 'desc' }, take: 1 } }
    });
  }

  get(professionalId: string, id: string) {
    return this.prisma.quote.findFirst({
      where: { id, professionalId },
      include: { contact: true, lead: true, documents: { orderBy: { version: 'desc' } }, attendance: { include: { incomeRecord: true } } }
    });
  }

  async create(professionalId: string, dto: CreateQuoteDto) {
    let contactId = dto.contactId;
    let contact: any = null;

    if (dto.contactId) {
      contact = await this.prisma.contact.findFirst({ where: { id: dto.contactId, professionalId } });
      if (!contact) throw new BadRequestException('Contact does not belong to this professional.');
    }

    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({ where: { id: dto.leadId, professionalId } });
      if (!lead) throw new BadRequestException('Lead does not belong to this professional.');
      contactId = contactId || lead.contactId || undefined;
    }

    if (!contactId) {
      throw new BadRequestException('Quote requires a contact or a lead with contact.');
    }

    if (!contact && contactId) {
      contact = await this.prisma.contact.findFirst({ where: { id: contactId, professionalId } });
      if (!contact) throw new BadRequestException('Contact does not belong to this professional.');
    }

    return this.prisma.quote.create({
      data: {
        professionalId,
        contactId,
        leadId: dto.leadId,
        title: dto.title,
        description: dto.description,
        amount: dto.amount,
        validityDays: dto.validityDays,
        paymentTerms: dto.paymentTerms,
        observations: dto.observations,
        status: 'DRAFT',
        message: await this.buildQuoteMessage(professionalId, dto.title, dto.description, dto.amount, contact?.fullName)
      },
      include: { contact: true, lead: true, attendance: true }
    });
  }

  async createForAssistant(professionalId: string, contactId: string, title?: string, amount?: number, status: QuoteStatus = 'PENDING_CONFIRMATION') {
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, professionalId } });
    if (!contact) throw new NotFoundException('Contact not found.');

    const lead = await this.findOrCreateLead(professionalId, contactId, title, amount);
    return this.prisma.quote.create({
      data: {
        professionalId,
        contactId,
        leadId: lead.id,
        title: title || 'Cotizacion WhatsApp',
        amount: amount || 0,
        status,
        message: await this.buildQuoteMessage(professionalId, title, undefined, amount, contact.fullName)
      },
      include: { contact: true, lead: true, attendance: true }
    });
  }

  async send(professionalId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, professionalId },
      include: { contact: true, lead: true }
    });

    if (!quote) throw new NotFoundException('Quote not found.');
    if (!quote.contact?.phone) throw new BadRequestException('Quote contact phone is required before sending.');

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

    const conversation = await this.upsertConversation(professionalId, connection.id, quote.contact.phone, quote.contact.fullName);
    const message = quote.message || await this.buildQuoteMessage(professionalId, quote.title, quote.description, quote.amount, quote.contact.fullName);
    let sendResult: any;
    try {
      sendResult = await this.kapso.sendTrackedTextMessage({
        professionalId,
        conversationId: conversation.id,
        phoneNumberId: connection.phoneNumberId,
        fromPhone: connection.displayPhone || connection.phoneNumberId,
        to: quote.contact.phone,
        body: message,
        source: 'quote',
        metadata: {
          quoteId: quote.id,
          leadId: quote.leadId
        }
      });
    } catch (error) {
      await this.prisma.quote.update({
        where: { id: quote.id },
        data: { status: 'FAILED', message }
      });
      throw error;
    }

    const updated = await this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: 'SENT',
        message,
        sentAt: new Date()
      },
      include: { contact: true, lead: true, attendance: true }
    });

    if (quote.leadId) {
      await this.prisma.lead.update({
        where: { id: quote.leadId },
        data: {
          status: 'CONTACTED',
          title: quote.title,
          estimatedValue: quote.amount || undefined
        }
      });
    }

    return {
      ok: true,
      simulated: Boolean(sendResult?.simulated),
      message,
      quote: updated,
      messageId: sendResult.messageId,
      conversationId: conversation.id
    };
  }

  generateDocument(professionalId: string, id: string) {
    return this.quotePdf.generate(professionalId, id);
  }

  listDocuments(professionalId: string, id: string) {
    return this.quotePdf.list(professionalId, id);
  }

  async sendDocument(
    professionalId: string,
    id: string,
    recipient: QuoteDocumentRecipient,
    options?: { recipientPhone?: string; phoneNumberId?: string }
  ) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, professionalId },
      include: { contact: true, professional: true, lead: true }
    });
    if (!quote) throw new NotFoundException('Quote not found.');

    const connection = options?.phoneNumberId
      ? await this.prisma.whatsAppConnection.findFirst({ where: { professionalId, phoneNumberId: options.phoneNumberId } })
      : await this.prisma.whatsAppConnection.findFirst({
        where: {
          professionalId,
          phoneNumberId: { not: null },
          status: { in: ['connected', 'CONNECTED'] }
        },
        orderBy: [{ connectionType: 'desc' }, { updatedAt: 'desc' }]
      });
    if (!connection?.phoneNumberId) throw new BadRequestException('No connected WhatsApp connection is available.');

    const professionalPhone = options?.recipientPhone
      || (quote.professional.assistantAllowedPhones || '').split(/[\s,;]+/).find(Boolean)
      || quote.professional.phone;
    const to = recipient === QuoteDocumentRecipient.CLIENT ? quote.contact?.phone : professionalPhone;
    if (!to) {
      throw new BadRequestException(
        recipient === QuoteDocumentRecipient.CLIENT
          ? 'Quote contact phone is required before sending.'
          : 'Professional authorized phone is required before sending.'
      );
    }

    const document = await this.quotePdf.latestOrGenerate(professionalId, id, quote.updatedAt);
    if (!document.publicUrl) throw new BadRequestException('Quote document does not have a public URL.');

    const targetName = recipient === QuoteDocumentRecipient.CLIENT
      ? quote.contact?.fullName
      : quote.professional.displayName;
    const conversation = await this.upsertConversation(professionalId, connection.id, to, targetName);
    const caption = recipient === QuoteDocumentRecipient.CLIENT
      ? `Cotizacion de ${quote.professional.displayName}: ${quote.title}`
      : `Tu cotizacion para ${quote.contact?.fullName || 'el cliente'} esta lista para reenviar.`;
    const source = recipient === QuoteDocumentRecipient.CLIENT ? 'quote_pdf_client' : 'quote_pdf_professional';

    const result = await this.kapso.sendTrackedDocumentMessage({
      professionalId,
      conversationId: conversation.id,
      phoneNumberId: connection.phoneNumberId,
      fromPhone: connection.displayPhone || connection.phoneNumberId,
      to,
      link: document.publicUrl,
      fileName: document.fileName,
      caption,
      source,
      metadata: {
        quoteId: quote.id,
        quoteDocumentId: document.id,
        recipient
      }
    });

    const now = new Date();
    await this.prisma.quoteDocument.update({
      where: { id: document.id },
      data: recipient === QuoteDocumentRecipient.CLIENT
        ? { sentToClientAt: now }
        : { sentToProfessionalAt: now }
    });

    let updatedQuote = quote;
    if (recipient === QuoteDocumentRecipient.CLIENT) {
      updatedQuote = await this.prisma.quote.update({
        where: { id: quote.id },
        data: { status: 'SENT', sentAt: now }
      }) as any;
      if (quote.leadId) {
        await this.prisma.lead.update({
          where: { id: quote.leadId },
          data: { status: 'CONTACTED', title: quote.title, estimatedValue: quote.amount || undefined }
        });
      }
    }

    return {
      ok: true,
      recipient,
      to,
      simulated: Boolean(result.simulated),
      messageId: result.messageId,
      document: await this.prisma.quoteDocument.findUnique({ where: { id: document.id } }),
      quote: updatedQuote
    };
  }

  async update(professionalId: string, id: string, dto: UpdateQuoteDto) {
    const quote = await this.prisma.quote.findFirst({ where: { id, professionalId } });
    if (!quote) throw new NotFoundException('Quote not found.');
    if (quote.status === 'CONVERTED') throw new BadRequestException('Converted quote cannot be edited.');

    if (dto.contactId) {
      const contact = await this.prisma.contact.findFirst({ where: { id: dto.contactId, professionalId } });
      if (!contact) throw new BadRequestException('Contact does not belong to this professional.');
    }

    const contact = dto.contactId
      ? await this.prisma.contact.findUnique({ where: { id: dto.contactId } })
      : await this.prisma.contact.findUnique({ where: { id: quote.contactId || '' } });
    const title = dto.title ?? quote.title;
    const description = dto.description ?? quote.description;
    const amount = dto.amount ?? quote.amount;

    return this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        ...dto,
        message: await this.buildQuoteMessage(professionalId, title, description, amount, contact?.fullName)
      },
      include: { contact: true, lead: true, attendance: true }
    });
  }

  async updateStatus(professionalId: string, id: string, status: QuoteStatus) {
    const quote = await this.prisma.quote.findFirst({ where: { id, professionalId } });
    if (!quote) throw new NotFoundException('Quote not found.');

    return this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        status,
        acceptedAt: status === 'ACCEPTED' ? new Date() : quote.acceptedAt,
        rejectedAt: status === 'REJECTED' ? new Date() : quote.rejectedAt
      },
      include: { contact: true, lead: true, attendance: true }
    });
  }

  async remove(professionalId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, professionalId },
      include: { attendance: true }
    });
    if (!quote) throw new NotFoundException('Quote not found.');
    if (quote.attendance || !['DRAFT', 'FAILED', 'CANCELLED'].includes(quote.status)) {
      throw new BadRequestException('Sent or converted quote cannot be deleted. Cancel it instead.');
    }
    return this.prisma.quote.delete({ where: { id: quote.id } });
  }

  async createAttendance(professionalId: string, id: string, dto: CreateAttendanceFromQuoteDto) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, professionalId },
      include: { contact: true, lead: true, attendance: true }
    });
    if (!quote) throw new NotFoundException('Quote not found.');
    if (quote.attendance) throw new BadRequestException('Quote already has an attendance.');

    const amount = dto.amount ?? quote.amount ?? 0;
    const title = dto.title || quote.title;
    const description = dto.description || quote.description || `Atencion creada desde cotizacion ${quote.title}`;
    const paymentStatus = dto.paymentStatus || 'PENDING';
    const paymentMethod = dto.paymentMethod || 'OTHER';

    return this.prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.create({
        data: {
          professionalId,
          contactId: quote.contactId,
          quoteId: quote.id,
          title,
          description,
          amount
        }
      });

      const incomeRecord = await tx.incomeRecord.create({
        data: {
          professionalId,
          contactId: quote.contactId,
          attendanceId: attendance.id,
          description: title,
          amount,
          paymentStatus,
          paymentMethod,
          paidAt: paymentStatus === 'PENDING' ? null : new Date()
        }
      });

      const updatedQuote = await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: 'CONVERTED',
          convertedAt: new Date()
        },
        include: { contact: true, lead: true, attendance: true }
      });

      if (quote.leadId) {
        await tx.lead.update({
          where: { id: quote.leadId },
          data: {
            status: 'WON',
            estimatedValue: amount,
            closedReason: 'Cotizacion convertida en atencion',
            closedAt: new Date()
          }
        });
      }

      return {
        quote: updatedQuote,
        attendance: await tx.attendance.findUnique({
          where: { id: attendance.id },
          include: { contact: true, incomeRecord: true, quote: true }
        }),
        incomeRecord
      };
    });
  }

  async buildQuoteMessage(professionalId: string, title?: string | null, description?: string | null, amount?: number | null, contactName?: string | null) {
    const template = await this.prisma.messageTemplate.findFirst({
      where: { professionalId, key: 'quote', active: true }
    });
    const amountText = amount ? `$${Number(amount).toLocaleString('es-CL')}` : 'por confirmar';
    if (template) {
      return this.templates.render(template.body, {
        cliente: contactName || '',
        servicio: title || 'Servicio a domicilio',
        detalle: description || '',
        monto: amountText
      });
    }

    return [
      `Hola ${contactName || 'gracias por contactarnos'}, te envio la cotizacion solicitada.`,
      '',
      `Servicio: ${title || 'Servicio a domicilio'}`,
      description ? `Detalle: ${description}` : null,
      `Valor estimado: ${amountText}`,
      '',
      'Si estas de acuerdo, responde "acepto" y coordinamos la atencion.'
    ].filter(Boolean).join('\n');
  }

  private async findOrCreateLead(professionalId: string, contactId: string, title?: string, amount?: number) {
    const existing = await this.prisma.lead.findFirst({
      where: {
        professionalId,
        contactId,
        status: { in: ['NEW', 'CONTACTED', 'SCHEDULED'] }
      },
      orderBy: { updatedAt: 'desc' }
    });
    if (existing) {
      return this.prisma.lead.update({
        where: { id: existing.id },
        data: {
          title: title || existing.title,
          estimatedValue: amount ?? existing.estimatedValue,
          status: 'CONTACTED'
        }
      });
    }

    return this.prisma.lead.create({
      data: {
        professionalId,
        contactId,
        title: title || 'Cotizacion WhatsApp',
        source: 'WhatsApp Assistant',
        status: 'CONTACTED',
        estimatedValue: amount
      }
    });
  }

  private async upsertConversation(professionalId: string, connectionId: string, contactPhone: string, contactName?: string | null) {
    const existing = await this.prisma.whatsAppConversation.findFirst({ where: { professionalId, contactPhone } });
    if (existing) {
      return this.prisma.whatsAppConversation.update({
        where: { id: existing.id },
        data: { contactName, lastMessageAt: new Date() }
      });
    }

    return this.prisma.whatsAppConversation.create({
      data: {
        professionalId,
        connectionId,
        contactPhone,
        contactName,
        lastMessageAt: new Date()
      }
    });
  }
}
