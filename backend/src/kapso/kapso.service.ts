import { BadGatewayException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { KapsoConfigService } from './kapso-config.service';
import { KapsoPlatformClient } from './kapso-platform.client';

export interface TrackedTextMessageInput {
  professionalId: string;
  phoneNumberId: string;
  to: string;
  body: string;
  conversationId?: string | null;
  fromPhone?: string | null;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface TrackedDocumentMessageInput {
  professionalId: string;
  phoneNumberId: string;
  to: string;
  link: string;
  fileName: string;
  caption?: string;
  conversationId?: string | null;
  fromPhone?: string | null;
  source: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class KapsoService {
  private readonly logger = new Logger(KapsoService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private kapsoConfig: KapsoConfigService,
    private platformClient: KapsoPlatformClient
  ) {
    this.kapsoConfig.validateForStartup();
  }

  async createSetupLink(professionalId: string, reconnectPhoneNumber?: string) {
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      include: {
        whatsappConnections: {
          orderBy: { updatedAt: 'desc' },
          take: 1
        }
      }
    });

    if (!professional) {
      throw new NotFoundException('Professional not found.');
    }

    if (this.kapsoConfig.isSandbox) {
      const appUrl = this.config.get<string>('APP_URL') || 'http://localhost:3000';
      const sandboxPhoneNumberId = this.kapsoConfig.sandboxPhoneNumberId || `sandbox-${professionalId}`;
      const connection = await this.getOrCreateSandboxConnection(professionalId, sandboxPhoneNumberId);

      return {
        url: `${appUrl}/mock-kapso-sandbox-setup?professionalId=${professionalId}&phoneNumberId=${encodeURIComponent(sandboxPhoneNumberId)}`,
        mode: 'sandbox',
        status: connection.status,
        setupLinkId: connection.setupLinkId,
        setupLinkStatus: connection.setupLinkStatus,
        expiresAt: connection.setupLinkExpiresAt,
        connectionId: connection.id,
        sandboxPhoneNumberId
      };
    }

    const connection = await this.getOrCreatePendingConnection(professionalId, professional.kapsoCustomerId);

    if (!this.kapsoConfig.isApiConfigured) {
      await this.markConnectionFailed(connection.id, 'KAPSO_API_KEY is not configured.');
      throw new ServiceUnavailableException('Kapso API is not configured. Set KAPSO_API_KEY before creating setup links.');
    }

    try {
      const customerId = await this.ensureKapsoCustomer(professional);
      const appUrl = this.config.get<string>('APP_URL') || 'http://localhost:3000';
      const setupLink = await this.platformClient.createSetupLink(customerId, {
        reconnectPhoneNumber,
        successRedirectUrl: `${appUrl}/api/kapso/setup/success`,
        failureRedirectUrl: `${appUrl}/api/kapso/setup/failed`
      });

      const updated = await this.prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: {
          kapsoCustomerId: customerId,
          setupLinkId: setupLink.id,
          setupLinkUrl: setupLink.url,
          setupLinkExpiresAt: setupLink.expiresAt ? new Date(setupLink.expiresAt) : null,
          setupLinkStatus: setupLink.whatsappSetupStatus || setupLink.status || 'pending',
          status: this.mapSetupStatus(setupLink.whatsappSetupStatus),
          lastError: setupLink.whatsappSetupError || null
        }
      });

      return {
        url: updated.setupLinkUrl,
        mode: 'kapso',
        status: updated.status,
        setupLinkId: updated.setupLinkId,
        setupLinkStatus: updated.setupLinkStatus,
        expiresAt: updated.setupLinkExpiresAt,
        connectionId: updated.id
      };
    } catch (error: any) {
      const message = error?.message || 'Kapso setup link creation failed.';
      await this.markConnectionFailed(connection.id, message);
      this.logger.error(`Kapso setup link failed for professional=${professionalId}: ${message}`);
      throw new BadGatewayException(message);
    }
  }

  async getStatus(professionalId: string) {
    const [professional, connection, lastAudit, lastMessage, lastInboundMessage, lastOutboundMessage, failedOutboundCount] = await Promise.all([
      this.prisma.professional.findUnique({
        where: { id: professionalId },
        include: { user: true }
      }),
      this.prisma.whatsAppConnection.findFirst({
        where: { professionalId },
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.auditLog.findFirst({
        where: { professionalId, action: 'KAPSO_WEBHOOK_RECEIVED' },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.whatsAppMessage.findFirst({
        where: { professionalId },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.whatsAppMessage.findFirst({
        where: { professionalId, direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.whatsAppMessage.findFirst({
        where: { professionalId, direction: 'OUTBOUND' },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.whatsAppMessage.count({
        where: { professionalId, direction: 'OUTBOUND', outboundStatus: 'FAILED' }
      })
    ]);

    const kapso = this.kapsoConfig.get();
    const commandPhones = [
      ...(professional?.assistantAllowedPhones || '').split(/[\s,;]+/),
      ...(professional?.phone ? [professional.phone] : []),
      ...kapso.assistantAllowedPhones
    ].map((phone) => this.normalizePhone(phone)).filter(Boolean);
    const uniqueCommandPhones = Array.from(new Set(commandPhones));
    const status = this.friendlyStatus(connection?.status, lastAudit?.createdAt);
    const fluxioPhone = kapso.platformPhoneDisplay || connection?.displayPhone || kapso.sandboxPhoneNumberId || null;

    return {
      ready: Boolean(professional && professional.user.accountStatus === 'ACTIVE' && professional.displayName && professional.profession && professional.phone && uniqueCommandPhones.length && fluxioPhone && lastInboundMessage),
      status,
      statusLabel: this.statusLabel(status),
      fluxioPhone,
      commandPhones: uniqueCommandPhones,
      lastActivityAt: lastMessage?.createdAt || lastAudit?.createdAt || null,
      hasReceivedFirstMessage: Boolean(lastInboundMessage || lastAudit),
      accountStatus: professional?.user.accountStatus || null,
      firstInboundAt: lastInboundMessage?.createdAt || lastAudit?.createdAt || null,
      lastInboundAt: lastInboundMessage?.createdAt || null,
      lastOutboundAt: lastOutboundMessage?.createdAt || null,
      lastOutboundStatus: lastOutboundMessage?.outboundStatus || null,
      failedOutboundCount,
      profileComplete: Boolean(professional?.displayName && professional?.profession && professional?.phone),
      templatesReady: await this.prisma.messageTemplate.count({ where: { professionalId, active: true } }),
      activationChecklist: this.buildActivationChecklist({
        accountActive: professional?.user.accountStatus === 'ACTIVE',
        profileComplete: Boolean(professional?.displayName && professional?.profession && professional?.phone),
        commandPhonesReady: uniqueCommandPhones.length > 0,
        fluxioPhoneReady: Boolean(fluxioPhone),
        firstInboundReady: Boolean(lastInboundMessage || lastAudit),
        outboundReady: Boolean(lastOutboundMessage && lastOutboundMessage.outboundStatus !== 'FAILED'),
        templatesReady: await this.prisma.messageTemplate.count({ where: { professionalId, active: true } }) >= 4
      }),
      connection: connection ? {
        id: connection.id,
        status: connection.status,
        connectionType: connection.connectionType,
        displayPhone: connection.displayPhone,
        lastError: connection.lastError
      } : null,
      support: {
        mode: kapso.mode,
        webhookConfigured: kapso.isWebhookConfigured,
        apiConfigured: kapso.isApiConfigured
      }
    };
  }

  async sendTextMessage(phoneNumberId: string, to: string, body: string) {
    const kapso = this.kapsoConfig.get();

    if (!kapso.isApiConfigured || !kapso.apiKey) {
      this.logger.warn(`KAPSO_API_KEY no configurada. Mensaje simulado para ${to}: ${body}`);
      return { simulated: true, to, body };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), kapso.requestTimeoutMs);

    try {
      const res = await fetch(`${kapso.apiBaseUrl}/meta/whatsapp/v24.0/${phoneNumberId}/messages`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': kapso.apiKey
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body }
        })
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(`Kapso sendTextMessage failed: ${res.status} ${error}`);
      }

      return res.json();
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error(`Kapso sendTextMessage timeout after ${kapso.requestTimeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendTrackedTextMessage(input: TrackedTextMessageInput) {
    const now = new Date();
    const savedMessage = await this.prisma.whatsAppMessage.create({
      data: {
        professionalId: input.professionalId,
        conversationId: input.conversationId || undefined,
        direction: 'OUTBOUND',
        outboundStatus: 'SENDING',
        outboundSource: input.source,
        fromPhone: input.fromPhone || input.phoneNumberId,
        toPhone: input.to,
        type: 'text',
        text: input.body,
        payload: {
          source: input.source,
          ...(input.metadata || {})
        }
      }
    });

    try {
      const result = await this.sendTextMessage(input.phoneNumberId, input.to, input.body);
      const kapsoMessageId = this.extractKapsoMessageId(result);
      const simulated = Boolean((result as any)?.simulated);
      const updated = await this.prisma.whatsAppMessage.update({
        where: { id: savedMessage.id },
        data: {
          kapsoMessageId,
          outboundStatus: simulated ? 'SIMULATED' : 'SENT',
          sentAt: now,
          payload: {
            source: input.source,
            ...(input.metadata || {}),
            kapso: result
          }
        }
      });

      return {
        ok: true,
        simulated,
        kapsoMessageId,
        messageId: updated.id,
        message: updated,
        kapso: result
      };
    } catch (error: any) {
      const message = error?.message || 'Kapso outbound message failed.';
      await this.prisma.whatsAppMessage.update({
        where: { id: savedMessage.id },
        data: {
          outboundStatus: 'FAILED',
          outboundError: message,
          failedAt: new Date(),
          payload: {
            source: input.source,
            ...(input.metadata || {}),
            error: message
          }
        }
      });
      throw error;
    }
  }

  async sendDocumentMessage(phoneNumberId: string, to: string, link: string, fileName: string, caption?: string) {
    const kapso = this.kapsoConfig.get();
    if (!kapso.isApiConfigured || !kapso.apiKey) {
      this.logger.warn(`KAPSO_API_KEY no configurada. Documento simulado para ${to}: ${fileName}`);
      return { simulated: true, to, link, fileName, caption };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), kapso.requestTimeoutMs);
    try {
      const res = await fetch(`${kapso.apiBaseUrl}/meta/whatsapp/v24.0/${phoneNumberId}/messages`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': kapso.apiKey
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'document',
          document: {
            link,
            filename: fileName,
            ...(caption ? { caption } : {})
          }
        })
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(`Kapso sendDocumentMessage failed: ${res.status} ${error}`);
      }
      return res.json();
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error(`Kapso sendDocumentMessage timeout after ${kapso.requestTimeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendTrackedDocumentMessage(input: TrackedDocumentMessageInput) {
    const savedMessage = await this.prisma.whatsAppMessage.create({
      data: {
        professionalId: input.professionalId,
        conversationId: input.conversationId || undefined,
        direction: 'OUTBOUND',
        outboundStatus: 'SENDING',
        outboundSource: input.source,
        fromPhone: input.fromPhone || input.phoneNumberId,
        toPhone: input.to,
        type: 'document',
        text: input.caption,
        payload: {
          source: input.source,
          document: { link: input.link, fileName: input.fileName },
          ...(input.metadata || {})
        }
      }
    });

    try {
      const result = await this.sendDocumentMessage(input.phoneNumberId, input.to, input.link, input.fileName, input.caption);
      const kapsoMessageId = this.extractKapsoMessageId(result);
      const simulated = Boolean((result as any)?.simulated);
      const updated = await this.prisma.whatsAppMessage.update({
        where: { id: savedMessage.id },
        data: {
          kapsoMessageId,
          outboundStatus: simulated ? 'SIMULATED' : 'SENT',
          sentAt: new Date(),
          payload: {
            source: input.source,
            document: { link: input.link, fileName: input.fileName },
            ...(input.metadata || {}),
            kapso: result
          }
        }
      });
      return { ok: true, simulated, kapsoMessageId, messageId: updated.id, message: updated, kapso: result };
    } catch (error: any) {
      const message = error?.message || 'Kapso outbound document failed.';
      await this.prisma.whatsAppMessage.update({
        where: { id: savedMessage.id },
        data: {
          outboundStatus: 'FAILED',
          outboundError: message,
          failedAt: new Date(),
          payload: {
            source: input.source,
            document: { link: input.link, fileName: input.fileName },
            ...(input.metadata || {}),
            error: message
          }
        }
      });
      throw error;
    }
  }

  private extractKapsoMessageId(result: any) {
    return result?.messages?.[0]?.id || result?.message?.id || result?.id || result?.data?.id || null;
  }

  private async ensureKapsoCustomer(professional: { id: string; displayName: string; kapsoCustomerId?: string | null }) {
    if (professional.kapsoCustomerId) return professional.kapsoCustomerId;

    const customer = await this.platformClient.createCustomer(professional.displayName, professional.id);
    await this.prisma.professional.update({
      where: { id: professional.id },
      data: { kapsoCustomerId: customer.id }
    });

    return customer.id;
  }

  private async getOrCreatePendingConnection(professionalId: string, kapsoCustomerId?: string | null) {
    const existing = await this.prisma.whatsAppConnection.findFirst({
      where: {
        professionalId,
        phoneNumberId: null
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (existing) {
      return this.prisma.whatsAppConnection.update({
        where: { id: existing.id },
        data: {
          kapsoCustomerId,
          status: 'pending',
          setupLinkStatus: 'pending',
          lastError: null
        }
      });
    }

    return this.prisma.whatsAppConnection.create({
      data: {
        professionalId,
        kapsoCustomerId,
        status: 'pending',
        setupLinkStatus: 'pending'
      }
    });
  }

  private async getOrCreateSandboxConnection(professionalId: string, phoneNumberId: string) {
    return this.prisma.whatsAppConnection.upsert({
      where: { phoneNumberId },
      update: {
        professionalId,
        status: 'connected',
        connectionType: 'sandbox',
        displayPhone: phoneNumberId,
        setupLinkStatus: 'sandbox',
        lastError: null
      },
      create: {
        professionalId,
        phoneNumberId,
        status: 'connected',
        connectionType: 'sandbox',
        displayPhone: phoneNumberId,
        setupLinkStatus: 'sandbox'
      }
    });
  }

  private async markConnectionFailed(connectionId: string, message: string) {
    return this.prisma.whatsAppConnection.update({
      where: { id: connectionId },
      data: {
        status: 'failed',
        setupLinkStatus: 'failed',
        lastError: message
      }
    });
  }

  private mapSetupStatus(status?: string) {
    if (!status) return 'pending';
    const normalized = status.toLowerCase();
    if (normalized === 'connected' || normalized === 'complete' || normalized === 'completed') return 'connected';
    if (normalized === 'failed' || normalized === 'error') return 'failed';
    return 'pending';
  }

  private friendlyStatus(connectionStatus?: string | null, lastWebhookAt?: Date | null) {
    const normalized = (connectionStatus || '').toLowerCase();
    if (normalized === 'failed') return 'needs_attention';
    if (normalized === 'connected' && lastWebhookAt) return 'ready';
    if (normalized === 'connected') return 'waiting_first_message';
    return 'not_ready';
  }

  private statusLabel(status: string) {
    if (status === 'ready') return 'Listo para recibir comandos';
    if (status === 'waiting_first_message') return 'Esperando tu primer mensaje';
    if (status === 'needs_attention') return 'Necesita revision';
    return 'Aun no configurado';
  }

  private buildActivationChecklist(flags: Record<string, boolean>) {
    return [
      {
        key: 'account_active',
        title: 'Cuenta aprobada',
        done: flags.accountActive,
        description: 'Fluxio ya habilito el acceso del profesional.'
      },
      {
        key: 'profile_complete',
        title: 'Perfil completo',
        done: flags.profileComplete,
        description: 'Nombre, profesion y telefono de trabajo.'
      },
      {
        key: 'command_phone',
        title: 'WhatsApp autorizado',
        done: flags.commandPhonesReady,
        description: 'El numero del profesional puede enviar comandos privados.'
      },
      {
        key: 'fluxio_phone',
        title: 'Numero Fluxio disponible',
        done: flags.fluxioPhoneReady,
        description: 'El profesional tiene un numero al que escribir.'
      },
      {
        key: 'first_inbound',
        title: 'Primer comando recibido',
        done: flags.firstInboundReady,
        description: 'Fluxio recibio al menos un mensaje del profesional.'
      },
      {
        key: 'first_outbound',
        title: 'Primera respuesta enviada',
        done: flags.outboundReady,
        description: 'Fluxio ya registro un mensaje saliente sin fallo.'
      },
      {
        key: 'templates',
        title: 'Plantillas base listas',
        done: flags.templatesReady,
        description: 'Cotizacion, cobro, recordatorio y confirmacion.'
      }
    ];
  }

  private normalizePhone(value?: string | null) {
    return (value || '').replace(/[^\d]/g, '');
  }
}
