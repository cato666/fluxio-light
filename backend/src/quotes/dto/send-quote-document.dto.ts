import { IsEnum } from 'class-validator';

export enum QuoteDocumentRecipient {
  CLIENT = 'CLIENT',
  PROFESSIONAL = 'PROFESSIONAL'
}

export class SendQuoteDocumentDto {
  @IsEnum(QuoteDocumentRecipient)
  recipient!: QuoteDocumentRecipient;
}
