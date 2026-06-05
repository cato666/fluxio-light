export interface KapsoWebhookHeadersDto {
  eventType?: string;
  signature?: string;
  idempotencyKey?: string;
  payloadVersion?: string;
  batch?: string;
  batchSize?: string;
}

export interface NormalizedKapsoWebhookEvent {
  type: string;
  idempotencyKey?: string;
  payloadVersion?: string;
  receivedAt: string;
  payload: any;
  data: any;
  message?: any;
  conversation?: any;
  phoneNumberId?: string;
}
