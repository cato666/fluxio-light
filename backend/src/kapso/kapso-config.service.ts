import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface KapsoConfig {
  mode: 'sandbox' | 'production';
  apiBaseUrl: string;
  apiKey?: string;
  webhookSecret?: string;
  defaultWorkspaceId?: string;
  sandboxPhoneNumberId?: string;
  platformPhoneDisplay?: string;
  assistantAllowedPhones: string[];
  requestTimeoutMs: number;
  isApiConfigured: boolean;
  isWebhookConfigured: boolean;
  isSandbox: boolean;
}

@Injectable()
export class KapsoConfigService {
  constructor(private readonly config: ConfigService) {}

  get(): KapsoConfig {
    const mode = this.parseMode(this.config.get<string>('KAPSO_MODE'));
    const apiBaseUrl = this.normalizeApiBaseUrl(
      this.config.get<string>('KAPSO_API_BASE_URL') || 'https://api.kapso.ai'
    );
    const apiKey = this.cleanOptional(this.config.get<string>('KAPSO_API_KEY'));
    const webhookSecret = this.cleanOptional(this.config.get<string>('KAPSO_WEBHOOK_SECRET'));
    const defaultWorkspaceId = this.cleanOptional(this.config.get<string>('KAPSO_DEFAULT_WORKSPACE_ID'));
    const sandboxPhoneNumberId = this.cleanOptional(this.config.get<string>('KAPSO_SANDBOX_PHONE_NUMBER_ID'));
    const platformPhoneDisplay = this.cleanOptional(this.config.get<string>('KAPSO_PLATFORM_PHONE_DISPLAY'));
    const assistantAllowedPhones = this.parsePhoneList(this.config.get<string>('KAPSO_ASSISTANT_ALLOWED_PHONES'));
    const requestTimeoutMs = this.parseTimeout(this.config.get<string>('KAPSO_REQUEST_TIMEOUT_MS'));

    return {
      mode,
      apiBaseUrl,
      apiKey,
      webhookSecret,
      defaultWorkspaceId,
      sandboxPhoneNumberId,
      platformPhoneDisplay,
      assistantAllowedPhones,
      requestTimeoutMs,
      isApiConfigured: this.hasRealValue(apiKey),
      isWebhookConfigured: this.hasRealValue(webhookSecret),
      isSandbox: mode === 'sandbox'
    };
  }

  get mode() {
    return this.get().mode;
  }

  get isSandbox() {
    return this.get().isSandbox;
  }

  get apiBaseUrl() {
    return this.get().apiBaseUrl;
  }

  get apiKey() {
    return this.get().apiKey;
  }

  get webhookSecret() {
    return this.get().webhookSecret;
  }

  get defaultWorkspaceId() {
    return this.get().defaultWorkspaceId;
  }

  get sandboxPhoneNumberId() {
    return this.get().sandboxPhoneNumberId;
  }

  get platformPhoneDisplay() {
    return this.get().platformPhoneDisplay;
  }

  get assistantAllowedPhones() {
    return this.get().assistantAllowedPhones;
  }

  get requestTimeoutMs() {
    return this.get().requestTimeoutMs;
  }

  get isApiConfigured() {
    return this.get().isApiConfigured;
  }

  get isWebhookConfigured() {
    return this.get().isWebhookConfigured;
  }

  validateForStartup() {
    this.parseMode(this.config.get<string>('KAPSO_MODE'));
    this.normalizeApiBaseUrl(this.config.get<string>('KAPSO_API_BASE_URL') || 'https://api.kapso.ai');
  }

  assertApiConfigured() {
    if (!this.isApiConfigured) {
      throw new Error('Kapso API credentials are not configured. Set KAPSO_API_KEY before calling real Kapso endpoints.');
    }
  }

  private normalizeApiBaseUrl(value: string) {
    const trimmed = value.trim();

    try {
      const url = new URL(trimmed);
      return url.toString().replace(/\/$/, '');
    } catch {
      throw new Error('KAPSO_API_BASE_URL must be a valid URL.');
    }
  }

  private cleanOptional(value?: string) {
    const trimmed = value?.trim();
    return trimmed || undefined;
  }

  private hasRealValue(value?: string) {
    if (!value) return false;
    const normalized = value.toLowerCase();
    return !normalized.startsWith('replace') && !normalized.includes('your_') && !normalized.includes('changeme');
  }

  private parseMode(value?: string): 'sandbox' | 'production' {
    const normalized = (value || 'sandbox').trim().toLowerCase();
    if (normalized === 'production') return 'production';
    if (normalized === 'sandbox') return 'sandbox';
    throw new Error('KAPSO_MODE must be either sandbox or production.');
  }

  private parseTimeout(value?: string) {
    const parsed = Number(value || 10000);
    if (!Number.isFinite(parsed) || parsed <= 0) return 10000;
    return parsed;
  }

  private parsePhoneList(value?: string) {
    return (value || '')
      .split(',')
      .map((phone) => this.normalizePhone(phone))
      .filter(Boolean);
  }

  private normalizePhone(value?: string) {
    return (value || '').replace(/[^\d]/g, '');
  }
}
