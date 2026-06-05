import { Injectable } from '@nestjs/common';
import { KapsoConfigService } from './kapso-config.service';

export interface KapsoCustomerResponse {
  id: string;
  name?: string;
  external_customer_id?: string;
}

export interface KapsoSetupLinkPayload {
  successRedirectUrl: string;
  failureRedirectUrl: string;
  reconnectPhoneNumber?: string;
}

export interface KapsoSetupLinkResponse {
  id: string;
  status?: string;
  url: string;
  expiresAt?: string;
  whatsappSetupStatus?: string;
  whatsappSetupError?: string | null;
}

@Injectable()
export class KapsoPlatformClient {
  constructor(private readonly kapsoConfig: KapsoConfigService) {}

  async createCustomer(name: string, externalCustomerId: string): Promise<KapsoCustomerResponse> {
    const data = await this.request('/platform/v1/customers', {
      method: 'POST',
      body: {
        customer: {
          name,
          external_customer_id: externalCustomerId
        }
      }
    });

    return data.data;
  }

  async createSetupLink(customerId: string, payload: KapsoSetupLinkPayload): Promise<KapsoSetupLinkResponse> {
    const setupLink: Record<string, unknown> = {
      success_redirect_url: payload.successRedirectUrl,
      failure_redirect_url: payload.failureRedirectUrl,
      allowed_connection_types: ['coexistence', 'dedicated']
    };

    if (payload.reconnectPhoneNumber) {
      setupLink.reconnect_phone_number = payload.reconnectPhoneNumber;
    }

    const data = await this.request(`/platform/v1/customers/${encodeURIComponent(customerId)}/setup_links`, {
      method: 'POST',
      body: { setup_link: setupLink }
    });
    const link = data.data;

    return {
      id: link.id,
      status: link.status,
      url: link.url,
      expiresAt: link.expires_at,
      whatsappSetupStatus: link.whatsapp_setup_status,
      whatsappSetupError: link.whatsapp_setup_error
    };
  }

  private async request(path: string, options: { method: string; body?: unknown }) {
    const kapso = this.kapsoConfig.get();
    this.kapsoConfig.assertApiConfigured();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), kapso.requestTimeoutMs);

    try {
      const res = await fetch(`${kapso.apiBaseUrl}${path}`, {
        method: options.method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': kapso.apiKey!
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) {
        const message = data?.error?.message || data?.message || text || 'Kapso API request failed.';
        throw new Error(`Kapso API ${res.status}: ${message}`);
      }

      return data;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error(`Kapso API timeout after ${kapso.requestTimeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
