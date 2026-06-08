import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';

type AdminSeverity = 'info' | 'warning' | 'critical';

export interface AdminNotificationEvent {
  type: string;
  severity?: AdminSeverity;
  title: string;
  message: string;
  professionalId?: string | null;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  adminPath?: string;
}

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async notify(event: AdminNotificationEvent) {
    const normalized: AdminNotificationEvent = {
      severity: 'info',
      ...event,
      metadata: this.sanitizeMetadata(event.metadata || {})
    };

    await this.recordEvent(normalized);
    await Promise.all([
      this.sendTelegram(normalized),
      this.publishWebhook(normalized)
    ]);
  }

  private async recordEvent(event: AdminNotificationEvent) {
    try {
      await this.prisma.auditLog.create({
        data: {
          professionalId: event.professionalId || null,
          action: 'ADMIN_EVENT_RECORDED',
          entity: event.entity || event.type,
          entityId: event.entityId || null,
          metadata: {
            type: event.type,
            severity: event.severity,
            title: event.title,
            message: event.message,
            adminPath: event.adminPath || null,
            ...(event.metadata || {})
          }
        }
      });
    } catch (error: any) {
      this.logger.warn(`No se pudo registrar evento admin ${event.type}: ${error?.message || error}`);
    }
  }

  private async sendTelegram(event: AdminNotificationEvent) {
    const enabled = this.booleanEnv('TELEGRAM_ADMIN_ENABLED');
    const botToken = this.clean(this.config.get<string>('TELEGRAM_BOT_TOKEN'));
    const chatId = this.clean(this.config.get<string>('TELEGRAM_ADMIN_CHAT_ID'));
    if (!enabled || !botToken || !chatId || !this.shouldSend(event.severity || 'info')) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: this.telegramText(event),
          disable_web_page_preview: true
        })
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Telegram API ${res.status}: ${body}`);
      }

      await this.prisma.auditLog.create({
        data: {
          professionalId: event.professionalId || null,
          action: 'ADMIN_TELEGRAM_NOTIFICATION_SENT',
          entity: event.entity || event.type,
          entityId: event.entityId || null,
          metadata: { type: event.type, severity: event.severity }
        }
      });
    } catch (error: any) {
      const message = error?.name === 'AbortError'
        ? 'Telegram API timeout.'
        : error?.message || 'Telegram notification failed.';
      this.logger.warn(message);
      await this.recordDeliveryFailure(event, 'telegram', message);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async publishWebhook(event: AdminNotificationEvent) {
    const enabled = this.booleanEnv('ADMIN_EVENTS_WEBHOOK_ENABLED');
    const url = this.clean(this.config.get<string>('ADMIN_EVENTS_WEBHOOK_URL'));
    if (!enabled || !url || !this.shouldSend(event.severity || 'info', 'ADMIN_EVENTS_MIN_LEVEL')) return;

    const payload = {
      id: `${event.type}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      source: 'fluxio-light',
      event
    };
    const body = JSON.stringify(payload);
    const secret = this.clean(this.config.get<string>('ADMIN_EVENTS_WEBHOOK_SECRET'));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { 'X-Fluxio-Signature': createHmac('sha256', secret).update(body).digest('hex') } : {})
        },
        body
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Admin webhook ${res.status}: ${text}`);
      }

      await this.prisma.auditLog.create({
        data: {
          professionalId: event.professionalId || null,
          action: 'ADMIN_WEBHOOK_EVENT_PUBLISHED',
          entity: event.entity || event.type,
          entityId: event.entityId || null,
          metadata: { type: event.type, severity: event.severity }
        }
      });
    } catch (error: any) {
      const message = error?.name === 'AbortError'
        ? 'Admin webhook timeout.'
        : error?.message || 'Admin webhook failed.';
      this.logger.warn(message);
      await this.recordDeliveryFailure(event, 'webhook', message);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async recordDeliveryFailure(event: AdminNotificationEvent, channel: string, message: string) {
    try {
      await this.prisma.auditLog.create({
        data: {
          professionalId: event.professionalId || null,
          action: 'ADMIN_NOTIFICATION_DELIVERY_FAILED',
          entity: event.entity || event.type,
          entityId: event.entityId || null,
          metadata: { type: event.type, severity: event.severity, channel, message }
        }
      });
    } catch {}
  }

  private telegramText(event: AdminNotificationEvent) {
    const appUrl = this.clean(this.config.get<string>('FRONTEND_URL'));
    const lines = [
      `[Fluxio] ${this.severityLabel(event.severity || 'info')} - ${event.title}`,
      '',
      event.message
    ];

    const metadata = event.metadata || {};
    const detailLines = [
      metadata.email ? `Email: ${metadata.email}` : null,
      metadata.professionalName ? `Profesional: ${metadata.professionalName}` : null,
      metadata.phone ? `Telefono: ${this.maskPhone(String(metadata.phone))}` : null,
      metadata.source ? `Origen: ${metadata.source}` : null,
      metadata.status ? `Estado: ${metadata.status}` : null,
      metadata.error ? `Error: ${this.truncate(String(metadata.error), 500)}` : null
    ].filter(Boolean);

    if (detailLines.length) lines.push('', ...detailLines);
    if (appUrl && event.adminPath) lines.push('', `Ver en Admin: ${appUrl.replace(/\/$/, '')}${event.adminPath}`);
    return lines.join('\n');
  }

  private shouldSend(severity: AdminSeverity, envName = 'TELEGRAM_ALERT_LEVEL') {
    const min = (this.clean(this.config.get<string>(envName)) || 'info').toLowerCase() as AdminSeverity;
    const order: Record<AdminSeverity, number> = { info: 1, warning: 2, critical: 3 };
    return order[severity] >= (order[min] || 1);
  }

  private severityLabel(severity: AdminSeverity) {
    if (severity === 'critical') return 'CRITICO';
    if (severity === 'warning') return 'ALERTA';
    return 'INFO';
  }

  private sanitizeMetadata(metadata: Record<string, unknown>) {
    const forbidden = ['token', 'secret', 'password', 'apiKey', 'api_key', 'botToken'];
    return Object.fromEntries(
      Object.entries(metadata).filter(([key]) => !forbidden.some((item) => key.toLowerCase().includes(item.toLowerCase())))
    );
  }

  private maskPhone(phone: string) {
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.length <= 4) return '***';
    return `***${digits.slice(-4)}`;
  }

  private truncate(value: string, max: number) {
    return value.length > max ? `${value.slice(0, max)}...` : value;
  }

  private booleanEnv(name: string) {
    const value = String(this.config.get<string>(name) || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(value);
  }

  private clean(value?: string) {
    const trimmed = String(value || '').trim();
    if (!trimmed || trimmed.startsWith('replace_') || trimmed.includes('your_')) return '';
    return trimmed;
  }
}
