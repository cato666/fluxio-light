import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EvidenceService } from '../evidence/evidence.service';
import { KapsoConfigService } from '../kapso/kapso-config.service';
import { KapsoService } from '../kapso/kapso.service';
import { MessageTemplatesService } from '../message-templates/message-templates.service';
import { ParsedCommand, WhatsappCommandParserService } from './whatsapp-command-parser.service';
import { WhatsappMediaService } from './whatsapp-media.service';
import { WhatsappResponseBuilderService } from './whatsapp-response-builder.service';
import { QuotesService } from '../quotes/quotes.service';
import { QuoteDocumentRecipient } from '../quotes/dto/send-quote-document.dto';

@Injectable()
export class WhatsappRouterService {
  private readonly logger = new Logger(WhatsappRouterService.name);
  private readonly pendingActionTtlMs = 10 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private parser: WhatsappCommandParserService,
    private responses: WhatsappResponseBuilderService,
    private kapso: KapsoService,
    private evidence: EvidenceService,
    private media: WhatsappMediaService,
    private kapsoConfig: KapsoConfigService,
    private templates: MessageTemplatesService,
    private quotes: QuotesService
  ) {}

  async handleKapsoEvent(event: any, _headers: any) {
    const type = event?.type || event?.event || event?.name;
    if (type === 'whatsapp.phone_number.created') {
      return this.handlePhoneNumberCreated(event);
    }
    if (type === 'whatsapp.message.sent' || type === 'whatsapp.message.delivered' || type === 'whatsapp.message.read') {
      return { processed: false, reason: 'outbound_or_status_event', type };
    }
    if (type === 'whatsapp.message.received' || event?.message) {
      return this.handleMessageReceived(event);
    }
    this.logger.log(`Evento Kapso ignorado: ${type || 'unknown'}`);
    return { processed: false, reason: 'ignored', type: type || 'unknown' };
  }

  private async handlePhoneNumberCreated(event: any) {
    const data = event?.data || event?.payload || event;
    const customerId = data?.customer?.id || data?.kapsoCustomerId;
    const phoneNumberId = data?.phone_number_id || event?.phoneNumberId;
    if (!phoneNumberId) return { processed: false, reason: 'missing_phone_number_id' };

    const existing = customerId
      ? await this.prisma.whatsAppConnection.findFirst({ where: { kapsoCustomerId: customerId } })
      : null;
    const professional = customerId
      ? await this.prisma.professional.findUnique({ where: { kapsoCustomerId: customerId } })
      : null;
    const professionalId = existing?.professionalId || professional?.id;
    if (!professionalId) return { processed: false, reason: 'missing_professional_for_customer' };

    await this.prisma.whatsAppConnection.upsert({
      where: { phoneNumberId },
      update: { status: 'connected', displayPhone: data?.display_phone_number, lastError: null },
      create: {
        professionalId,
        kapsoCustomerId: customerId,
        phoneNumberId,
        status: 'connected',
        displayPhone: data?.display_phone_number
      }
    });

    return { processed: true, type: 'whatsapp.phone_number.created', phoneNumberId };
  }

  private async handleMessageReceived(event: any) {
    const data = event?.data || event?.payload || event;
    const message = event?.message || data?.message || data?.messages?.[0] || data;
    const conversationPayload = event?.conversation || data?.conversation;
    const phoneNumberId =
      event?.phoneNumberId ||
      data?.phone_number_id ||
      conversationPayload?.phone_number_id ||
      data?.metadata?.phone_number_id ||
      message?.phone_number_id;
    const fromPhone = message?.from || data?.from || data?.contact?.wa_id || conversationPayload?.phone_number;
    const contactName = conversationPayload?.kapso?.contact_name || message?.profile?.name || message?.username || conversationPayload?.username;
    const text = message?.text?.body || message?.body || message?.kapso?.content || data?.text;
    const msgType = message?.type || data?.type || (text ? 'text' : 'unknown');
    const direction = message?.kapso?.direction || data?.direction || event?.direction;

    if (this.isOutboundWebhookEcho(direction, message, data)) {
      await this.updateOutboundStatusFromWebhook(message, data);
      return { processed: false, reason: 'outbound_echo', messageId: message?.id };
    }

    let connection = await this.prisma.whatsAppConnection.findFirst({
      where: phoneNumberId ? { phoneNumberId } : { status: 'connected' }
    });

    if (!connection && this.kapsoConfig.isSandbox) {
      connection = await this.getOrCreateSandboxConnection(phoneNumberId);
    }

    if (!connection) {
      this.logger.warn(`No existe conexion para phoneNumberId=${phoneNumberId}`);
      return { processed: false, reason: 'missing_connection', phoneNumberId };
    }

    const assistantProfessional = msgType === 'text'
      ? await this.findProfessionalByAssistantPhone(fromPhone)
      : null;
    const professionalId = assistantProfessional?.id || connection.professionalId;

    if (msgType === 'text' && await this.isRecentEcho(professionalId, fromPhone, text)) {
      return { processed: false, reason: 'recent_text_echo', fromPhone, text };
    }

    if (msgType === 'text' && this.isFluxioGeneratedAssistantReply(text)) {
      return { processed: false, reason: 'generated_reply_echo', fromPhone, text };
    }

    let conversation = await this.prisma.whatsAppConversation.findFirst({
      where: conversationPayload?.id
        ? { professionalId, kapsoConversationId: conversationPayload.id }
        : { professionalId, contactPhone: fromPhone || 'unknown' }
    });

    if (!conversation) {
      conversation = await this.prisma.whatsAppConversation.create({
        data: {
          professionalId,
          connectionId: connection.id,
          contactPhone: fromPhone || 'unknown',
          contactName,
          kapsoConversationId: conversationPayload?.id,
          lastMessageAt: new Date()
        }
      });
    } else {
      conversation = await this.prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: {
          contactName: contactName || conversation.contactName,
          kapsoConversationId: conversationPayload?.id || conversation.kapsoConversationId,
          lastMessageAt: new Date()
        }
      });
    }

    const existingMessage = message?.id
      ? await this.prisma.whatsAppMessage.findFirst({ where: { professionalId, kapsoMessageId: message.id } })
      : null;

    if (existingMessage) {
      return { processed: true, professionalId, duplicate: true, messageId: existingMessage.id };
    }

    const savedMessage = await this.prisma.whatsAppMessage.create({
      data: {
        professionalId,
        conversationId: conversation.id,
        kapsoMessageId: message?.id,
        direction: 'INBOUND',
        fromPhone,
        toPhone: connection.displayPhone || phoneNumberId,
        type: msgType,
        text,
        payload: event?.payload || event
      }
    });

    const professional = assistantProfessional || await this.prisma.professional.findUnique({ where: { id: professionalId } });
    if (msgType === 'text' && this.isAssistantCommandSender(fromPhone, professional)) {
      const result = await this.handleAssistantCommand(professionalId, connection.phoneNumberId, fromPhone, text);
      return { processed: true, professionalId, commandChannel: true, messageId: savedMessage.id, conversationId: conversation.id, ...result };
    }

    if (msgType === 'text') {
      const quoteResponse = await this.handleCustomerQuoteResponse(professionalId, connection.phoneNumberId, fromPhone, text);
      if (quoteResponse) {
        await this.replyIfPossible(connection.phoneNumberId, fromPhone, quoteResponse.reply);
        return {
          processed: true,
          professionalId,
          quoteResponse: true,
          messageId: savedMessage.id,
          conversationId: conversation.id,
          ...quoteResponse
        };
      }
    }

    if (['image', 'video', 'audio', 'document'].includes(msgType)) {
      const contact = await this.findOrCreateContact(professionalId, fromPhone, contactName);
      const lead = await this.findOrCreateLeadForMedia(professionalId, contact.id, text || contactName);
      const media = this.media.extract(message, msgType);
      const stored = await this.media.store(media);

      await this.evidence.createFromStoredFile(professionalId, {
        type: media.type,
        category: media.category,
        storageProvider: stored?.storageProvider || 'kapso',
        storageKey: stored?.storageKey || message?.id || savedMessage.id,
        publicUrl: stored?.publicUrl || media.mediaUrl,
        originalFileName: media.originalFileName,
        mimeType: media.mimeType,
        caption: media.caption,
        source: 'whatsapp',
        contactId: contact.id,
        leadId: lead.id,
        conversationId: conversation.id,
        messageId: savedMessage.id
      });

      await this.replyIfPossible(connection.phoneNumberId, fromPhone, this.responses.evidenceReceived());
      return { processed: true, professionalId, messageId: savedMessage.id, media: true };
    }

    await this.ensureLeadForUnknownContact(professionalId, fromPhone, text, contactName);

    const command = this.parser.parse(text);
    let reply = this.responses.unknown();

    if (command.type === 'MENU') reply = this.responses.menu();

    if (command.type === 'NEW_LEAD') {
      const contact = await this.findOrCreateContact(professionalId, fromPhone, command.name, command.source);
      await this.prisma.lead.create({
        data: {
          professionalId,
          contactId: contact.id,
          title: command.description || 'Nuevo lead WhatsApp',
          description: text,
          source: command.source || 'WhatsApp'
        }
      });
      reply = this.responses.leadCreated(command.name);
    }

    if (command.type === 'REGISTER_ATTENDANCE') {
      const contact = await this.findOrCreateContact(professionalId, fromPhone, command.name);
      const attendance = await this.prisma.attendance.create({
        data: {
          professionalId,
          contactId: contact.id,
          title: command.title || 'Atencion registrada por WhatsApp',
          amount: command.amount || 0
        }
      });
      if (command.amount) {
        await this.prisma.incomeRecord.create({
          data: {
            professionalId,
            contactId: contact.id,
            attendanceId: attendance.id,
            description: attendance.title,
            amount: command.amount,
            paymentMethod: this.mapPaymentMethod(command.paymentMethod),
            paymentStatus: 'PAID',
            paidAt: new Date()
          }
        });
      }
      reply = this.responses.attendanceCreated(command.title, command.amount);
    }

    if (command.type === 'REGISTER_EXPENSE') {
      await this.prisma.expense.create({
        data: {
          professionalId,
          description: command.description || 'Gasto registrado por WhatsApp',
          amount: command.amount || 0
        }
      });
      reply = this.responses.expenseCreated(command.amount);
    }

    if (command.type === 'UPDATE_CONTACT_PHONE') {
      if (!command.phone) {
        reply = this.responses.missingPhone();
      } else {
        const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
        if (resolved.reply) {
          await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
          return { professionalId, command: command.type, needsClarification: true };
        }

        reply = await this.executeContactCommand(professionalId, resolved.contact!.id, command, text, fromPhone, phoneNumberId);
      }
    }

    if (command.type === 'CREATE_APPOINTMENT') {
      const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
      if (resolved.reply) {
        await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
        return { professionalId, command: command.type, needsClarification: true };
      }

      reply = await this.executeContactCommand(professionalId, resolved.contact!.id, command, text, fromPhone, phoneNumberId);
    }

    if (command.type === 'QUOTE') {
      const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
      if (resolved.reply) {
        await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
        return { professionalId, command: command.type, needsClarification: true };
      }

      const contact = resolved.contact!;
      if (!contact.phone) {
        reply = this.responses.quoteNeedsPhone(contact.fullName);
      } else {
        const quote = await this.createPendingQuote(professionalId, contact.id, command.service, command.amount);
        await this.savePendingAssistantAction(professionalId, fromPhone, 'CONFIRM_SEND_QUOTE', {
          contactId: contact.id,
          quoteId: quote.id,
          service: command.service,
          amount: command.amount
        });
        reply = this.responses.quoteConfirmation(contact.fullName, command.service, command.amount);
      }
    }

    if (command.type === 'QUOTE_PDF_SELF') {
      const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
      if (resolved.reply) {
        await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
        return { professionalId, command: command.type, needsClarification: true };
      }
      reply = await this.executeContactCommand(professionalId, resolved.contact!.id, command, text, fromPhone, phoneNumberId);
    }

    if (command.type === 'QUOTE_QUERY') {
      if (command.name) {
        const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
        if (resolved.reply) {
          await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
          return { professionalId, command: command.type, needsClarification: true };
        }
        reply = await this.buildQuoteListReply(professionalId, command.status || 'all', resolved.contact!.id, resolved.contact!.fullName);
      } else {
        reply = await this.buildQuoteListReply(professionalId, command.status || 'pending');
      }
    }

    if (command.type === 'PAYMENT_QUERY') {
      if (command.name) {
        const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
        if (resolved.reply) {
          await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
          return { professionalId, command: command.type, needsClarification: true };
        }
        reply = await this.buildPendingPaymentsReply(professionalId, resolved.contact!.id, resolved.contact!.fullName);
      } else {
        reply = await this.buildPendingPaymentsReply(professionalId);
      }
    }

    if (command.type === 'PAYMENT_RECEIVED' || command.type === 'PAYMENT_REMINDER') {
      const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
      if (resolved.reply) {
        await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
        return { professionalId, command: command.type, needsClarification: true };
      }
      reply = await this.executeContactCommand(professionalId, resolved.contact!.id, command, text, fromPhone, phoneNumberId);
    }

    if (command.type === 'CONVERT_QUOTE') {
      const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
      if (resolved.reply) {
        await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
        return { professionalId, command: command.type, needsClarification: true };
      }

      reply = await this.convertLatestAcceptedQuote(professionalId, resolved.contact!.id);
    }

    if (command.type === 'AGENDA_QUERY') {
      reply = await this.buildAgendaReply(professionalId, command.day);
    }

    if (command.type === 'MONTH_SUMMARY') {
      const summary = await this.buildMonthSummary(professionalId);
      reply = `Este mes llevas:\nIngresos: $${summary.income.toLocaleString('es-CL')}\nGastos: $${summary.expenses.toLocaleString('es-CL')}\nUtilidad estimada: $${(summary.income - summary.expenses).toLocaleString('es-CL')}\nAtenciones: ${summary.attendances}`;
    }

    await this.replyIfPossible(connection.phoneNumberId, fromPhone, reply);
    return { processed: true, professionalId, messageId: savedMessage.id, conversationId: conversation.id };
  }

  private async handleAssistantCommand(professionalId: string, phoneNumberId?: string | null, fromPhone?: string, text?: string) {
    if (this.isFluxioGeneratedAssistantReply(text)) {
      return { professionalId, ignored: true, reason: 'assistant_reply_echo' };
    }

    const pending = await this.findPendingAssistantAction(professionalId, fromPhone);
    const command = this.parser.parse(text);

    if (pending && !this.shouldReplacePendingAction(command, text)) {
      return this.handlePendingAssistantAction(pending, professionalId, phoneNumberId, fromPhone, text);
    }

    if (pending) {
      await this.prisma.assistantPendingAction.delete({ where: { id: pending.id } });
    }

    if (command.type === 'UNKNOWN') {
      return { professionalId, command: command.type, ignored: true, reason: 'unknown_assistant_text' };
    }

    let reply = this.responses.unknown();

    if (command.type === 'MENU') reply = this.responses.menu();

    if (command.type === 'NEW_LEAD') {
      const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
      if (resolved.reply) {
        await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
        return { professionalId, command: command.type, needsClarification: true };
      }

      reply = await this.executeContactCommand(professionalId, resolved.contact!.id, command, text, fromPhone, phoneNumberId);
    }

    if (command.type === 'REGISTER_ATTENDANCE') {
      const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
      if (resolved.reply) {
        await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
        return { professionalId, command: command.type, needsClarification: true };
      }

      reply = await this.executeContactCommand(professionalId, resolved.contact!.id, command, text, fromPhone, phoneNumberId);
    }

    if (command.type === 'REGISTER_EXPENSE') {
      await this.prisma.expense.create({
        data: {
          professionalId,
          description: command.description || 'Gasto registrado por WhatsApp',
          amount: command.amount || 0
        }
      });
      reply = this.responses.expenseCreated(command.amount);
    }

    if (command.type === 'UPDATE_CONTACT_PHONE') {
      if (!command.phone) {
        reply = this.responses.missingPhone();
      } else {
        const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
        if (resolved.reply) {
          await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
          return { professionalId, command: command.type, needsClarification: true };
        }

        reply = await this.executeContactCommand(professionalId, resolved.contact!.id, command, text, fromPhone, phoneNumberId);
      }
    }

    if (command.type === 'CREATE_APPOINTMENT') {
      const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
      if (resolved.reply) {
        await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
        return { professionalId, command: command.type, needsClarification: true };
      }

      reply = await this.executeContactCommand(professionalId, resolved.contact!.id, command, text, fromPhone, phoneNumberId);
    }

    if (command.type === 'QUOTE') {
      const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
      if (resolved.reply) {
        await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
        return { professionalId, command: command.type, needsClarification: true };
      }

      const contact = resolved.contact!;
      if (!contact.phone) {
        reply = this.responses.quoteNeedsPhone(contact.fullName);
      } else {
        const quote = await this.createPendingQuote(professionalId, contact.id, command.service, command.amount);
        await this.savePendingAssistantAction(professionalId, fromPhone, 'CONFIRM_SEND_QUOTE', {
          contactId: contact.id,
          quoteId: quote.id,
          service: command.service,
          amount: command.amount
        });
        reply = this.responses.quoteConfirmation(contact.fullName, command.service, command.amount);
      }
    }

    if (command.type === 'QUOTE_PDF_SELF') {
      const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
      if (resolved.reply) {
        await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
        return { professionalId, command: command.type, needsClarification: true };
      }
      reply = await this.executeContactCommand(professionalId, resolved.contact!.id, command, text, fromPhone, phoneNumberId);
    }

    if (command.type === 'QUOTE_QUERY') {
      if (command.name) {
        const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
        if (resolved.reply) {
          await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
          return { professionalId, command: command.type, needsClarification: true };
        }
        reply = await this.buildQuoteListReply(professionalId, command.status || 'all', resolved.contact!.id, resolved.contact!.fullName);
      } else {
        reply = await this.buildQuoteListReply(professionalId, command.status || 'pending');
      }
    }

    if (command.type === 'PAYMENT_QUERY') {
      if (command.name) {
        const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
        if (resolved.reply) {
          await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
          return { professionalId, command: command.type, needsClarification: true };
        }
        reply = await this.buildPendingPaymentsReply(professionalId, resolved.contact!.id, resolved.contact!.fullName);
      } else {
        reply = await this.buildPendingPaymentsReply(professionalId);
      }
    }

    if (command.type === 'PAYMENT_RECEIVED' || command.type === 'PAYMENT_REMINDER') {
      const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
      if (resolved.reply) {
        await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
        return { professionalId, command: command.type, needsClarification: true };
      }
      reply = await this.executeContactCommand(professionalId, resolved.contact!.id, command, text, fromPhone, phoneNumberId);
    }

    if (command.type === 'CONVERT_QUOTE') {
      const resolved = await this.resolveCommandContact(professionalId, fromPhone, command, command.name, text);
      if (resolved.reply) {
        await this.replyIfPossible(phoneNumberId, fromPhone, resolved.reply);
        return { professionalId, command: command.type, needsClarification: true };
      }

      reply = await this.convertLatestAcceptedQuote(professionalId, resolved.contact!.id);
    }

    if (command.type === 'AGENDA_QUERY') {
      reply = await this.buildAgendaReply(professionalId, command.day);
    }

    if (command.type === 'MONTH_SUMMARY') {
      const summary = await this.buildMonthSummary(professionalId);
      reply = `Este mes llevas:\nIngresos: $${summary.income.toLocaleString('es-CL')}\nGastos: $${summary.expenses.toLocaleString('es-CL')}\nUtilidad estimada: $${(summary.income - summary.expenses).toLocaleString('es-CL')}\nAtenciones: ${summary.attendances}`;
    }

    await this.replyIfPossible(phoneNumberId, fromPhone, reply);
    return { professionalId, command: command.type };
  }

  private async handlePendingAssistantAction(
    pending: any,
    professionalId: string,
    phoneNumberId?: string | null,
    fromPhone?: string,
    text?: string
  ) {
    const answer = this.normalizeText(text);

    if (['cancelar', 'cancela', 'no', 'n'].includes(answer)) {
      if (pending.type === 'CONFIRM_SEND_QUOTE' && (pending.payload as any)?.quoteId) {
        await this.prisma.quote.updateMany({
          where: { id: (pending.payload as any).quoteId, professionalId },
          data: { status: 'CANCELLED' }
        });
      }
      await this.prisma.assistantPendingAction.delete({ where: { id: pending.id } });
      const reply = this.responses.pendingCancelled();
      await this.replyIfPossible(phoneNumberId, fromPhone, reply);
      return { pendingAction: pending.type, cancelled: true };
    }

    const payload = pending.payload as any;

    if (pending.type === 'RESOLVE_CONTACT') {
      const index = Number(answer);
      const candidate = Number.isInteger(index) ? payload.candidates?.[index - 1] : null;
      if (!candidate?.id) {
        const reply = this.responses.invalidPendingResponse();
        await this.replyIfPossible(phoneNumberId, fromPhone, reply);
        return { pendingAction: pending.type, needsClarification: true };
      }

      await this.prisma.assistantPendingAction.delete({ where: { id: pending.id } });
      const reply = await this.executeContactCommand(professionalId, candidate.id, payload.command, payload.originalText, fromPhone, phoneNumberId);
      await this.replyIfPossible(phoneNumberId, fromPhone, reply);
      return { pendingAction: pending.type, resolved: true, contactId: candidate.id, command: payload.command?.type };
    }

    if (pending.type === 'CONFIRM_CREATE_CONTACT') {
      if (!['si', 's', 'sí'].includes(answer)) {
        const reply = this.responses.invalidPendingResponse();
        await this.replyIfPossible(phoneNumberId, fromPhone, reply);
        return { pendingAction: pending.type, needsClarification: true };
      }

      const target = payload.target || 'Cliente sin nombre';
      const targetPhone = this.normalizePhone(target);
      const looksLikePhone = targetPhone.length >= 8;
      const contact = await this.prisma.contact.create({
        data: {
          professionalId,
          fullName: looksLikePhone ? undefined : target,
          phone: looksLikePhone ? targetPhone : undefined,
          source: 'WhatsApp Assistant'
        }
      });

      await this.prisma.assistantPendingAction.delete({ where: { id: pending.id } });
      const reply = await this.executeContactCommand(professionalId, contact.id, payload.command, payload.originalText, fromPhone, phoneNumberId);
      await this.replyIfPossible(phoneNumberId, fromPhone, reply);
      return { pendingAction: pending.type, resolved: true, contactId: contact.id, command: payload.command?.type };
    }

    if (pending.type === 'CONFIRM_SEND_QUOTE') {
      if (!['si', 's', 'sí'].includes(answer)) {
        const reply = this.responses.invalidPendingResponse();
        await this.replyIfPossible(phoneNumberId, fromPhone, reply);
        return { pendingAction: pending.type, needsClarification: true };
      }

      await this.prisma.assistantPendingAction.delete({ where: { id: pending.id } });
      const result = await this.sendQuoteToContact(professionalId, phoneNumberId, payload.contactId, payload.service, payload.amount, payload.quoteId);
      await this.replyIfPossible(phoneNumberId, fromPhone, result.reply);
      return {
        pendingAction: pending.type,
        resolved: true,
        contactId: payload.contactId,
        sent: result.sent,
        simulated: result.simulated
      };
    }

    await this.prisma.assistantPendingAction.delete({ where: { id: pending.id } });
    const reply = this.responses.pendingCancelled();
    await this.replyIfPossible(phoneNumberId, fromPhone, reply);
    return { pendingAction: pending.type, cancelled: true, reason: 'unknown_pending_type' };
  }

  private async executeContactCommand(professionalId: string, contactId: string, command: ParsedCommand, originalText?: string, fromPhone?: string, phoneNumberId?: string | null) {
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, professionalId } });
    if (!contact) return this.responses.missingContactTarget();

    if (command.type === 'NEW_LEAD') {
      await this.prisma.lead.create({
        data: {
          professionalId,
          contactId: contact.id,
          title: command.description || 'Nuevo lead WhatsApp',
          description: originalText,
          source: command.source || 'WhatsApp'
        }
      });
      return this.responses.leadCreated(contact.fullName || command.name);
    }

    if (command.type === 'REGISTER_ATTENDANCE') {
      const attendance = await this.prisma.attendance.create({
        data: {
          professionalId,
          contactId: contact.id,
          title: command.title || 'Atencion registrada por WhatsApp',
          amount: command.amount || 0
        }
      });

      if (command.amount) {
        await this.prisma.incomeRecord.create({
          data: {
            professionalId,
            contactId: contact.id,
            attendanceId: attendance.id,
            description: attendance.title,
            amount: command.amount,
            paymentMethod: this.mapPaymentMethod(command.paymentMethod),
            paymentStatus: 'PAID',
            paidAt: new Date()
          }
        });
      }

      return this.responses.attendanceCreated(command.title, command.amount, contact.fullName);
    }

    if (command.type === 'UPDATE_CONTACT_PHONE') {
      if (!command.phone) return this.responses.missingPhone();

      const phone = this.formatPhoneForDisplay(this.normalizePhone(command.phone));
      const updated = await this.prisma.contact.update({
        where: { id: contact.id },
        data: { phone }
      });

      return this.responses.phoneUpdated(updated.fullName, updated.phone);
    }

    if (command.type === 'CREATE_APPOINTMENT') {
      const startsAt = this.parseAppointmentDate(command.startsAtText);
      if (!startsAt) return this.responses.invalidAppointmentDate();

      const appointment = await this.prisma.appointment.create({
        data: {
          professionalId,
          contactId: contact.id,
          title: command.title || 'Cita agendada por WhatsApp',
          location: command.location,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000)
        },
        include: { contact: true }
      });

      return this.responses.appointmentCreated(appointment.contact?.fullName, appointment.title, appointment.startsAt, appointment.location);
    }

    if (command.type === 'QUOTE') {
      if (!contact.phone) return this.responses.quoteNeedsPhone(contact.fullName);

      const quote = await this.createPendingQuote(professionalId, contact.id, command.service, command.amount);
      await this.savePendingAssistantAction(professionalId, fromPhone, 'CONFIRM_SEND_QUOTE', {
        contactId: contact.id,
        quoteId: quote.id,
        service: command.service,
        amount: command.amount
      });

      return this.responses.quoteConfirmation(contact.fullName, command.service, command.amount);
    }

    if (command.type === 'QUOTE_PDF_SELF') {
      if (!phoneNumberId || !fromPhone) return 'No hay conexion WhatsApp disponible para enviarte el PDF.';
      const quote = await this.quotes.createForAssistant(
        professionalId,
        contact.id,
        command.service,
        command.amount,
        'DRAFT'
      );
      const result = await this.quotes.sendDocument(
        professionalId,
        quote.id,
        QuoteDocumentRecipient.PROFESSIONAL,
        { recipientPhone: fromPhone, phoneNumberId }
      );
      return this.responses.quotePdfSentToProfessional(contact.fullName, Boolean(result.simulated));
    }

    if (command.type === 'PAYMENT_RECEIVED') {
      return this.registerPaymentReceived(professionalId, contact.id, command.amount, command.paymentMethod);
    }

    if (command.type === 'PAYMENT_REMINDER') {
      return this.sendPaymentReminder(professionalId, phoneNumberId, contact.id);
    }

    return this.responses.unknown();
  }

  private async getOrCreateSandboxConnection(phoneNumberId?: string) {
    const sandboxPhoneNumberId = phoneNumberId || this.kapsoConfig.sandboxPhoneNumberId;
    if (!sandboxPhoneNumberId) return null;

    const professional = await this.prisma.professional.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!professional) return null;

    return this.prisma.whatsAppConnection.upsert({
      where: { phoneNumberId: sandboxPhoneNumberId },
      update: {
        professionalId: professional.id,
        status: 'connected',
        connectionType: 'sandbox',
        displayPhone: sandboxPhoneNumberId,
        lastError: null
      },
      create: {
        professionalId: professional.id,
        phoneNumberId: sandboxPhoneNumberId,
        status: 'connected',
        connectionType: 'sandbox',
        displayPhone: sandboxPhoneNumberId
      }
    });
  }

  private isAssistantCommandSender(fromPhone?: string, professional?: { phone?: string | null; assistantAllowedPhones?: string | null } | null) {
    const normalizedFrom = this.normalizePhone(fromPhone);
    if (!normalizedFrom) return false;

    const configuredPhones = this.kapsoConfig.assistantAllowedPhones;
    if (configuredPhones.includes(normalizedFrom)) return true;

    const professionalAllowedPhones = this.parseAllowedPhones(professional?.assistantAllowedPhones);
    if (professionalAllowedPhones.includes(normalizedFrom)) return true;

    const normalizedProfessionalPhone = this.normalizePhone(professional?.phone);
    return Boolean(normalizedProfessionalPhone && normalizedProfessionalPhone === normalizedFrom);
  }

  private async findProfessionalByAssistantPhone(fromPhone?: string | null) {
    const normalizedFrom = this.normalizePhone(fromPhone);
    if (!normalizedFrom) return null;

    const professionals = await this.prisma.professional.findMany({
      where: {
        user: { accountStatus: 'ACTIVE' },
        OR: [
          { phone: { not: null } },
          { assistantAllowedPhones: { not: null } }
        ]
      },
      include: { user: true },
      orderBy: { updatedAt: 'desc' },
      take: 300
    });

    return professionals.find((professional) => {
      const allowedPhones = [
        this.normalizePhone(professional.phone),
        ...this.parseAllowedPhones(professional.assistantAllowedPhones)
      ].filter(Boolean);

      return allowedPhones.includes(normalizedFrom);
    }) || null;
  }

  private parseAllowedPhones(value?: string | null) {
    return (value || '')
      .split(/[\s,;]+/)
      .map((phone) => this.normalizePhone(phone))
      .filter(Boolean);
  }

  private async resolveCommandContact(
    professionalId: string,
    fromPhone: string | undefined,
    command: ParsedCommand,
    target?: string,
    originalText?: string
  ) {
    const trimmed = target?.trim();
    if (!trimmed) return { reply: this.responses.missingContactTarget() };

    const targetPhone = this.normalizePhone(trimmed);
    const looksLikePhone = targetPhone.length >= 8;

    const candidates = await this.prisma.contact.findMany({
      where: {
        professionalId,
        OR: [
          { fullName: { contains: trimmed, mode: 'insensitive' } },
          ...(looksLikePhone ? [{ phone: { contains: targetPhone } }] : [])
        ]
      },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });

    const exact = candidates.filter((contact) => {
      const sameName = contact.fullName && this.normalizeText(contact.fullName) === this.normalizeText(trimmed);
      const samePhone = looksLikePhone && contact.phone && this.normalizePhone(contact.phone) === targetPhone;
      return sameName || samePhone;
    });
    if (exact.length === 1) return { contact: exact[0] };
    if (exact.length > 1) {
      await this.savePendingAssistantAction(professionalId, fromPhone, 'RESOLVE_CONTACT', {
        command,
        originalText,
        target: trimmed,
        candidates: exact.slice(0, 5).map((contact) => ({
          id: contact.id,
          fullName: contact.fullName,
          phone: contact.phone,
          source: contact.source,
          commune: contact.commune
        }))
      });
      return { reply: this.responses.ambiguousContact(exact, this.commandLabel(command)) };
    }

    if (candidates.length === 1) return { contact: candidates[0] };
    if (candidates.length > 1) {
      await this.savePendingAssistantAction(professionalId, fromPhone, 'RESOLVE_CONTACT', {
        command,
        originalText,
        target: trimmed,
        candidates: candidates.slice(0, 5).map((contact) => ({
          id: contact.id,
          fullName: contact.fullName,
          phone: contact.phone,
          source: contact.source,
          commune: contact.commune
        }))
      });
      return { reply: this.responses.ambiguousContact(candidates, this.commandLabel(command)) };
    }

    await this.savePendingAssistantAction(professionalId, fromPhone, 'CONFIRM_CREATE_CONTACT', {
      command,
      originalText,
      target: trimmed
    });

    return { reply: this.responses.confirmCreateContact(trimmed, this.commandLabel(command)) };
  }

  private async findPendingAssistantAction(professionalId: string, fromPhone?: string) {
    const normalizedFrom = this.normalizePhone(fromPhone);
    if (!normalizedFrom) return null;

    await this.prisma.assistantPendingAction.deleteMany({
      where: { professionalId, fromPhone: normalizedFrom, expiresAt: { lt: new Date() } }
    });

    return this.prisma.assistantPendingAction.findFirst({
      where: { professionalId, fromPhone: normalizedFrom, expiresAt: { gt: new Date() } },
      orderBy: { updatedAt: 'desc' }
    });
  }

  private async savePendingAssistantAction(professionalId: string, fromPhone: string | undefined, type: string, payload: any) {
    const normalizedFrom = this.normalizePhone(fromPhone);
    if (!normalizedFrom) return null;

    await this.prisma.assistantPendingAction.deleteMany({ where: { professionalId, fromPhone: normalizedFrom } });

    return this.prisma.assistantPendingAction.create({
      data: {
        professionalId,
        fromPhone: normalizedFrom,
        type,
        payload,
        expiresAt: new Date(Date.now() + this.pendingActionTtlMs)
      }
    });
  }

  private shouldReplacePendingAction(command: ParsedCommand, text?: string) {
    const normalized = this.normalizeText(text);
    if (!normalized || ['si', 's', 'no', 'n', 'cancelar', 'cancela'].includes(normalized)) return false;
    if (/^\d+$/.test(normalized)) return false;
    return command.type !== 'UNKNOWN';
  }

  private isOutboundWebhookEcho(direction: string | undefined, message: any, data: any) {
    const normalizedDirection = this.normalizeText(direction);
    const status = this.normalizeText(message?.kapso?.status || data?.status || message?.status);
    if (normalizedDirection === 'outbound') return true;
    if (normalizedDirection === 'inbound') return false;
    if (['sent', 'delivered', 'read'].includes(status) && (message?.kapso?.direction === 'outbound' || data?.direction === 'outbound')) return true;
    if (message?.from_me === true || message?.fromMe === true) return true;
    return false;
  }

  private async isRecentEcho(professionalId: string, fromPhone?: string, text?: string) {
    const normalizedText = (text || '').trim();
    if (!normalizedText || normalizedText.length < 3) return false;

    const since = new Date(Date.now() - 20 * 1000);
    const recentCount = await this.prisma.whatsAppMessage.count({
      where: {
        professionalId,
        fromPhone,
        text: normalizedText,
        createdAt: { gte: since }
      }
    });

    return recentCount >= 2;
  }

  private commandLabel(command: ParsedCommand) {
    if (command.type === 'REGISTER_ATTENDANCE') return 'registrar la atencion';
    if (command.type === 'NEW_LEAD') return 'registrar el lead';
    if (command.type === 'UPDATE_CONTACT_PHONE') return 'actualizar el telefono';
    if (command.type === 'CREATE_APPOINTMENT') return 'agendar la cita';
    if (command.type === 'QUOTE') return 'preparar la cotizacion';
    if (command.type === 'QUOTE_PDF_SELF') return 'preparar el PDF de la cotizacion';
    if (command.type === 'QUOTE_QUERY') return 'consultar cotizaciones';
    if (command.type === 'CONVERT_QUOTE') return 'convertir la cotizacion en atencion';
    if (command.type === 'PAYMENT_QUERY') return 'consultar cobros pendientes';
    if (command.type === 'PAYMENT_RECEIVED') return 'registrar el pago';
    if (command.type === 'PAYMENT_REMINDER') return 'enviar el cobro';
    return 'continuar';
  }

  private isFluxioGeneratedAssistantReply(text?: string) {
    const normalized = this.normalizeText(text);
    if (!normalized) return false;

    const prefixes = [
      'no pude interpretar la respuesta',
      'atencion registrada',
      'lead registrado',
      'gasto registrado',
      'cita agendada',
      'cotizacion lista',
      'cotizacion enviada',
      'pdf preparado',
      'cotizaciones pendientes:',
      'cotizaciones aceptadas:',
      'cotizaciones rechazadas:',
      'cotizaciones de ',
      'cobros pendientes:',
      'pendientes de cobro:',
      'pago registrado',
      'cobro enviado',
      'no encontre cobros pendientes',
      'atencion creada desde cotizacion',
      'no puedo enviar la cotizacion',
      'no encontre una cotizacion aceptada',
      'agenda hoy:',
      'agenda manana:',
      'no encontre a',
      'encontre mas de un cliente posible',
      'listo cancele la accion pendiente',
      'no entendi completamente el mensaje',
      'este mes llevas',
      'hola soy fluxio light'
    ];

    return prefixes.some((prefix) => normalized.startsWith(prefix));
  }

  private async ensureLeadForUnknownContact(professionalId: string, phone?: string, text?: string, name?: string) {
    if (!phone) return;
    const existing = await this.prisma.contact.findFirst({ where: { professionalId, phone } });
    if (existing) return;

    const contact = await this.prisma.contact.create({
      data: { professionalId, phone, fullName: name, source: 'WhatsApp', notes: text }
    });

    await this.prisma.lead.create({
      data: {
        professionalId,
        contactId: contact.id,
        title: 'Nuevo contacto desde WhatsApp',
        description: text || 'Mensaje inicial recibido por WhatsApp',
        source: 'WhatsApp'
      }
    });
  }

  private async findOrCreateLeadForMedia(professionalId: string, contactId: string, description?: string) {
    const existing = await this.prisma.lead.findFirst({
      where: { professionalId, contactId, status: { in: ['NEW', 'CONTACTED', 'SCHEDULED'] } },
      orderBy: { createdAt: 'desc' }
    });
    if (existing) return existing;

    return this.prisma.lead.create({
      data: {
        professionalId,
        contactId,
        title: 'Evidencia recibida por WhatsApp',
        description: description || 'Media recibida por WhatsApp',
        source: 'WhatsApp'
      }
    });
  }

  private async findOrCreateContact(professionalId: string, phone?: string, name?: string, source?: string) {
    const existing = phone ? await this.prisma.contact.findFirst({ where: { professionalId, phone } }) : null;
    if (existing) {
      if (name && !existing.fullName) {
        return this.prisma.contact.update({ where: { id: existing.id }, data: { fullName: name } });
      }
      return existing;
    }

    return this.prisma.contact.create({
      data: {
        professionalId,
        phone,
        fullName: name,
        source: source || 'WhatsApp'
      }
    });
  }

  private async buildMonthSummary(professionalId: string) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [income, expenses, attendances] = await Promise.all([
      this.prisma.incomeRecord.aggregate({ where: { professionalId, createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      this.prisma.expense.aggregate({ where: { professionalId, createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      this.prisma.attendance.count({ where: { professionalId, performedAt: { gte: start, lt: end } } })
    ]);

    return {
      income: income._sum.amount || 0,
      expenses: expenses._sum.amount || 0,
      attendances
    };
  }

  private async buildAgendaReply(professionalId: string, day: 'today' | 'tomorrow') {
    const range = this.dayRange(day);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        professionalId,
        startsAt: { gte: range.start, lt: range.end },
        status: { not: 'CANCELLED' }
      },
      orderBy: { startsAt: 'asc' },
      include: { contact: true }
    });

    return this.responses.agendaList(day === 'today' ? 'hoy' : 'manana', appointments);
  }

  private async buildQuoteListReply(professionalId: string, status: 'pending' | 'accepted' | 'rejected' | 'all' = 'pending', contactId?: string, contactName?: string | null) {
    const statusMap = {
      pending: ['PENDING_CONFIRMATION', 'SENT', 'DRAFT'],
      accepted: ['ACCEPTED'],
      rejected: ['REJECTED'],
      all: ['DRAFT', 'PENDING_CONFIRMATION', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED', 'FAILED', 'CANCELLED']
    };

    const quotes = await this.prisma.quote.findMany({
      where: {
        professionalId,
        ...(contactId ? { contactId } : {}),
        status: { in: statusMap[status] as any }
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 8,
      include: { contact: true }
    });

    const label =
      status === 'accepted' ? 'Cotizaciones aceptadas' :
      status === 'rejected' ? 'Cotizaciones rechazadas' :
      status === 'all' ? 'Cotizaciones' :
      'Cotizaciones pendientes';

    return this.responses.quoteList(contactName ? `${label} de ${contactName}` : label, quotes);
  }

  private async convertLatestAcceptedQuote(professionalId: string, contactId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: {
        professionalId,
        contactId,
        status: 'ACCEPTED',
        attendance: null
      },
      orderBy: [{ acceptedAt: 'desc' }, { updatedAt: 'desc' }],
      include: { contact: true, lead: true }
    });

    if (!quote) {
      const contact = await this.prisma.contact.findFirst({ where: { id: contactId, professionalId } });
      return this.responses.noAcceptedQuote(contact?.fullName);
    }

    const paymentStatus = 'PENDING';
    const paymentMethod = 'OTHER';
    const amount = quote.amount || 0;

    return this.prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.create({
        data: {
          professionalId,
          contactId: quote.contactId,
          quoteId: quote.id,
          title: quote.title,
          description: quote.description || `Atencion creada desde cotizacion ${quote.title}`,
          amount
        }
      });

      await tx.incomeRecord.create({
        data: {
          professionalId,
          contactId: quote.contactId,
          attendanceId: attendance.id,
          description: quote.title,
          amount,
          paymentStatus,
          paymentMethod,
          paidAt: null
        }
      });

      await tx.quote.update({
        where: { id: quote.id },
        data: { status: 'CONVERTED', convertedAt: new Date() }
      });

      if (quote.leadId) {
        await tx.lead.update({
          where: { id: quote.leadId },
          data: { status: 'WON', estimatedValue: amount }
        });
      }

      return this.responses.quoteConverted(quote.contact?.fullName, quote.title, amount);
    });
  }

  private async buildPendingPaymentsReply(professionalId: string, contactId?: string, contactName?: string | null) {
    const rows = await this.prisma.incomeRecord.findMany({
      where: {
        professionalId,
        ...(contactId ? { contactId } : {}),
        paymentStatus: { in: ['PENDING', 'PARTIAL'] }
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 8,
      include: { contact: true, attendance: true }
    });

    return this.responses.paymentList(contactName ? `Pendientes de cobro de ${contactName}` : 'Pendientes de cobro', rows);
  }

  private async registerPaymentReceived(professionalId: string, contactId: string, amount?: number, paymentMethod?: string) {
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, professionalId } });
    const pending = await this.prisma.incomeRecord.findFirst({
      where: {
        professionalId,
        contactId,
        paymentStatus: { in: ['PENDING', 'PARTIAL'] }
      },
      orderBy: [{ createdAt: 'asc' }],
      include: { contact: true }
    });

    if (!pending) return this.responses.noPendingPayments(contact?.fullName);

    const receivedAmount = amount || pending.amount;
    const paymentStatus = receivedAmount >= pending.amount ? 'PAID' : 'PARTIAL';
    const note = receivedAmount < pending.amount
      ? `\nPago parcial registrado por WhatsApp: $${receivedAmount.toLocaleString('es-CL')}`
      : '';

    const updated = await this.prisma.incomeRecord.update({
      where: { id: pending.id },
      data: {
        paymentStatus: paymentStatus as any,
        paymentMethod: this.mapPaymentMethod(paymentMethod),
        paidAt: paymentStatus === 'PAID' ? new Date() : pending.paidAt,
        description: note && !pending.description.includes(note.trim())
          ? `${pending.description}${note}`
          : pending.description
      },
      include: { contact: true }
    });

    return this.responses.paymentReceived(updated.contact?.fullName || contact?.fullName, receivedAmount, updated.paymentStatus);
  }

  private async sendPaymentReminder(professionalId: string, phoneNumberId: string | null | undefined, contactId: string) {
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, professionalId } });
    if (!contact?.phone) return this.responses.paymentNeedsPhone(contact?.fullName);
    if (!phoneNumberId) return 'No hay conexion WhatsApp disponible para enviar el cobro.';

    const pending = await this.prisma.incomeRecord.findFirst({
      where: {
        professionalId,
        contactId,
        paymentStatus: { in: ['PENDING', 'PARTIAL'] }
      },
      orderBy: [{ createdAt: 'asc' }],
      include: { attendance: true, contact: true }
    });

    if (!pending) return this.responses.noPendingPayments(contact.fullName);

    const message = await this.buildPaymentPendingMessage(
      professionalId,
      contact.fullName,
      pending.description || pending.attendance?.title,
      pending.amount
    );

    let sendResult: any;
    try {
      sendResult = await this.kapso.sendTrackedTextMessage({
        professionalId,
        phoneNumberId,
        to: contact.phone,
        body: message,
        source: 'assistant_payment_reminder',
        metadata: {
          incomeRecordId: pending.id
        }
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar cobro WhatsApp: ${error}`);
      return this.responses.paymentReminderFailed(contact.fullName);
    }

    const connection = await this.prisma.whatsAppConnection.findFirst({ where: { professionalId, phoneNumberId } });
    let conversation = await this.prisma.whatsAppConversation.findFirst({ where: { professionalId, contactPhone: contact.phone } });
    if (conversation) {
      conversation = await this.prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { contactName: contact.fullName, lastMessageAt: new Date() }
      });
    } else {
      conversation = await this.prisma.whatsAppConversation.create({
        data: {
          professionalId,
          connectionId: connection?.id,
          contactPhone: contact.phone,
          contactName: contact.fullName,
          lastMessageAt: new Date()
        }
      });
    }

    await this.prisma.whatsAppMessage.update({
      where: { id: sendResult.messageId },
      data: {
        conversationId: conversation.id,
        fromPhone: connection?.displayPhone || phoneNumberId
      }
    });

    return this.responses.paymentReminderSent(contact.fullName, Boolean(sendResult?.simulated));
  }

  private async buildPaymentPendingMessage(professionalId: string, contactName?: string | null, service?: string | null, amount?: number | null) {
    const templates = await this.templates.ensureDefaults(professionalId);
    const template = templates.find((item) => item.key === 'payment_pending' && item.active);
    if (!template) {
      return [
        `Hola ${contactName || ''}`.trim() + ', te recuerdo que queda un pago pendiente.',
        service ? `Detalle: ${service}` : undefined,
        amount ? `Monto: $${Number(amount).toLocaleString('es-CL')}` : undefined,
        'Gracias.'
      ].filter(Boolean).join('\n');
    }

    return this.templates.render(template.body, {
      cliente: contactName || 'cliente',
      servicio: service || 'servicio realizado',
      monto: amount ? `$${Number(amount).toLocaleString('es-CL')}` : 'por confirmar',
      fecha: '',
      detalle: service || ''
    });
  }

  private async sendQuoteToContact(
    professionalId: string,
    phoneNumberId: string | null | undefined,
    contactId: string,
    service?: string,
    amount?: number,
    quoteId?: string
  ) {
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, professionalId } });
    if (!contact?.phone) return { sent: false, reply: this.responses.quoteNeedsPhone(contact?.fullName), simulated: false };
    if (!phoneNumberId) return { sent: false, reply: 'No hay conexion WhatsApp disponible para enviar la cotizacion.', simulated: false };

    const message = await this.buildQuoteMessage(professionalId, contact.fullName, service, amount);
    let sendResult: any;

    try {
      sendResult = await this.kapso.sendTrackedTextMessage({
        professionalId,
        phoneNumberId,
        to: contact.phone,
        body: message,
        source: 'assistant_quote',
        metadata: {
          quoteId
        }
      });
    } catch (error) {
      if (quoteId) {
        await this.prisma.quote.updateMany({
          where: { id: quoteId, professionalId },
          data: { status: 'FAILED', message }
        });
      }
      this.logger.error(`No se pudo enviar cotizacion WhatsApp: ${error}`);
      return { sent: false, reply: this.responses.quoteSendFailed(contact.fullName), simulated: false };
    }

    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { professionalId, phoneNumberId }
    });

    const conversation = await this.prisma.whatsAppConversation.upsert({
      where: {
        id: (await this.prisma.whatsAppConversation.findFirst({ where: { professionalId, contactPhone: contact.phone } }))?.id || ''
      },
      update: {
        contactName: contact.fullName,
        lastMessageAt: new Date()
      },
      create: {
        professionalId,
        connectionId: connection?.id,
        contactPhone: contact.phone,
        contactName: contact.fullName,
        lastMessageAt: new Date()
      }
    }).catch(async () => {
      const existing = await this.prisma.whatsAppConversation.findFirst({ where: { professionalId, contactPhone: contact.phone } });
      if (existing) {
        return this.prisma.whatsAppConversation.update({
          where: { id: existing.id },
          data: { contactName: contact.fullName, lastMessageAt: new Date() }
        });
      }
      return this.prisma.whatsAppConversation.create({
        data: {
          professionalId,
          connectionId: connection?.id,
          contactPhone: contact.phone!,
          contactName: contact.fullName,
          lastMessageAt: new Date()
        }
      });
    });

    const lead = await this.prisma.lead.findFirst({
      where: {
        professionalId,
        contactId: contact.id,
        status: { in: ['NEW', 'CONTACTED', 'SCHEDULED'] }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const quoteLead = lead
      ? await this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          title: service || lead.title,
          estimatedValue: amount ?? lead.estimatedValue,
          status: 'CONTACTED',
          description: [lead.description, `Cotizacion enviada por WhatsApp: ${message}`].filter(Boolean).join('\n\n')
        }
      })
      : await this.prisma.lead.create({
        data: {
          professionalId,
          contactId: contact.id,
          title: service || 'Cotizacion WhatsApp',
          description: `Cotizacion enviada por WhatsApp: ${message}`,
          source: 'WhatsApp Assistant',
          status: 'CONTACTED',
          estimatedValue: amount
        }
      });

    const quote = quoteId
      ? await this.prisma.quote.update({
        where: { id: quoteId },
        data: {
          leadId: quoteLead.id,
          status: 'SENT',
          message,
          sentAt: new Date()
        }
      })
      : await this.prisma.quote.create({
        data: {
          professionalId,
          contactId: contact.id,
          leadId: quoteLead.id,
          title: service || 'Cotizacion WhatsApp',
          amount: amount || 0,
          status: 'SENT',
          message,
          sentAt: new Date()
        }
      });

    await this.prisma.whatsAppMessage.update({
      where: { id: sendResult.messageId },
      data: {
        conversationId: conversation.id,
        fromPhone: connection?.displayPhone || phoneNumberId,
        payload: {
          source: 'assistant_quote',
          quoteId: quote.id,
          leadId: quoteLead.id,
          kapso: sendResult.kapso
        }
      }
    });

    return {
      sent: true,
      reply: this.responses.quoteSent(contact.fullName),
      simulated: Boolean(sendResult?.simulated)
    };
  }

  private async createPendingQuote(professionalId: string, contactId: string, service?: string, amount?: number) {
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, professionalId } });
    const lead = await this.prisma.lead.findFirst({
      where: {
        professionalId,
        contactId,
        status: { in: ['NEW', 'CONTACTED', 'SCHEDULED'] }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const quoteLead = lead
      ? await this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          title: service || lead.title,
          estimatedValue: amount ?? lead.estimatedValue,
          status: 'CONTACTED'
        }
      })
      : await this.prisma.lead.create({
        data: {
          professionalId,
          contactId,
          title: service || 'Cotizacion WhatsApp',
          source: 'WhatsApp Assistant',
          status: 'CONTACTED',
          estimatedValue: amount
        }
      });

    return this.prisma.quote.create({
      data: {
        professionalId,
        contactId,
        leadId: quoteLead.id,
        title: service || 'Cotizacion WhatsApp',
        amount: amount || 0,
        status: 'PENDING_CONFIRMATION',
        message: await this.buildQuoteMessage(professionalId, contact?.fullName, service, amount)
      }
    });
  }

  private async buildQuoteMessage(professionalId: string, contactName?: string | null, service?: string | null, amount?: number | null) {
    const templates = await this.templates.ensureDefaults(professionalId);
    const template = templates.find((item) => item.key === 'quote' && item.active);
    if (!template) return this.responses.quoteMessage(contactName, service, amount || undefined);

    return this.templates.render(template.body, {
      cliente: contactName || 'cliente',
      servicio: service || 'servicio solicitado',
      monto: amount ? `$${Number(amount).toLocaleString('es-CL')}` : 'por confirmar',
      fecha: '',
      detalle: service || ''
    });
  }

  private async handleCustomerQuoteResponse(professionalId: string, phoneNumberId?: string | null, fromPhone?: string, text?: string) {
    const intent = this.detectQuoteResponseIntent(text);
    if (!intent) return null;

    const contact = await this.findContactByPhone(professionalId, fromPhone);
    if (!contact) return null;

    const quote = await this.prisma.quote.findFirst({
      where: {
        professionalId,
        contactId: contact.id,
        status: { in: ['SENT', 'PENDING_CONFIRMATION'] }
      },
      orderBy: [{ sentAt: 'desc' }, { updatedAt: 'desc' }]
    });

    if (!quote) return null;

    const status = intent === 'accepted' ? 'ACCEPTED' : 'REJECTED';
    await this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        status,
        acceptedAt: intent === 'accepted' ? new Date() : quote.acceptedAt,
        rejectedAt: intent === 'rejected' ? new Date() : quote.rejectedAt
      }
    });

    if (quote.leadId) {
      const lead = await this.prisma.lead.findFirst({ where: { id: quote.leadId, professionalId } });
      await this.prisma.lead.update({
        where: { id: quote.leadId },
        data: {
          status: intent === 'accepted' ? 'CONTACTED' : 'LOST',
          description: [
            lead?.description,
            `Cliente ${intent === 'accepted' ? 'acepto' : 'rechazo'} cotizacion por WhatsApp: ${text || ''}`.trim()
          ].filter(Boolean).join('\n')
        }
      }).catch(() => undefined);
    }

    return {
      quoteId: quote.id,
      status,
      reply: intent === 'accepted'
        ? this.responses.quoteAcceptedByCustomer(quote.title)
        : this.responses.quoteRejectedByCustomer(quote.title),
      phoneNumberId
    };
  }

  private detectQuoteResponseIntent(text?: string) {
    const normalized = this.normalizeText(text);
    if (!normalized) return null;

    const accepted = [
      'acepto',
      'aceptamos',
      'aceptado',
      'si acepto',
      'si, acepto',
      'ok acepto',
      'confirmo',
      'confirmado',
      'de acuerdo',
      'dale',
      'me sirve',
      'esta bien',
      'ok esta bien'
    ];

    const rejected = [
      'rechazo',
      'rechazado',
      'no acepto',
      'no gracias',
      'no me sirve',
      'muy caro',
      'lo dejo pendiente',
      'por ahora no',
      'no por ahora',
      'cancelar',
      'cancelo'
    ];

    if (accepted.some((phrase) => normalized === phrase || normalized.includes(phrase))) return 'accepted';
    if (rejected.some((phrase) => normalized === phrase || normalized.includes(phrase))) return 'rejected';
    return null;
  }

  private async findContactByPhone(professionalId: string, phone?: string | null) {
    const normalized = this.normalizePhone(phone);
    if (!normalized) return null;

    const candidates = await this.prisma.contact.findMany({
      where: { professionalId, phone: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: 200
    });

    return candidates.find((contact) => this.normalizePhone(contact.phone) === normalized) || null;
  }

  private dayRange(day: 'today' | 'tomorrow') {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (day === 'tomorrow' ? 1 : 0));
    return {
      start: base,
      end: new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1)
    };
  }

  private parseAppointmentDate(value?: string) {
    const raw = (value || '').trim();
    const normalized = this.normalizeText(raw);
    const timeMatch = raw.match(/(\d{1,2}):(\d{2})/);

    if ((normalized.startsWith('hoy') || normalized.startsWith('manana')) && timeMatch) {
      const now = new Date();
      const offset = normalized.startsWith('manana') ? 1 : 0;
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, Number(timeMatch[1]), Number(timeMatch[2]));
    }

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
    if (isoMatch) {
      return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]), Number(isoMatch[4]), Number(isoMatch[5]));
    }

    const clMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+(\d{1,2}):(\d{2})$/);
    if (clMatch) {
      return new Date(Number(clMatch[3]), Number(clMatch[2]) - 1, Number(clMatch[1]), Number(clMatch[4]), Number(clMatch[5]));
    }

    return null;
  }

  private mapPaymentMethod(method?: string): any {
    const m = (method || '').toLowerCase();
    if (m.includes('transfer')) return 'TRANSFER';
    if (m.includes('efectivo')) return 'CASH';
    if (m.includes('tarjeta')) return 'CARD';
    return 'OTHER';
  }

  private async replyIfPossible(phoneNumberId?: string | null, to?: string, body?: string) {
    if (!phoneNumberId || !to || !body) return;
    try {
      await this.kapso.sendTextMessage(phoneNumberId, to, body);
    } catch (error) {
      this.logger.error(`No se pudo responder por WhatsApp: ${error}`);
    }
  }

  private async updateOutboundStatusFromWebhook(message: any, data: any) {
    const kapsoMessageId = message?.id || data?.message_id || data?.messageId || data?.id;
    if (!kapsoMessageId) return;

    const status = this.normalizeText(message?.kapso?.status || data?.status || message?.status);
    const statusMap: Record<string, any> = {
      sent: { outboundStatus: 'SENT', sentAt: new Date() },
      delivered: { outboundStatus: 'DELIVERED', deliveredAt: new Date() },
      read: { outboundStatus: 'READ', readAt: new Date() },
      failed: { outboundStatus: 'FAILED', failedAt: new Date(), outboundError: message?.kapso?.error || data?.error || message?.error || 'Kapso outbound failed' }
    };
    const patch = statusMap[status];
    if (!patch) return;

    await this.prisma.whatsAppMessage.updateMany({
      where: {
        kapsoMessageId,
        direction: 'OUTBOUND'
      },
      data: patch
    });
  }

  private normalizePhone(value?: string | null) {
    return (value || '').replace(/[^\d]/g, '');
  }

  private formatPhoneForDisplay(value?: string | null) {
    const normalized = this.normalizePhone(value);
    return normalized ? `+${normalized}` : undefined;
  }

  private normalizeText(value?: string | null) {
    return (value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
