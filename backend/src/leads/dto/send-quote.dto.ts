import { IsOptional, IsString } from 'class-validator';

export class SendQuoteDto {
  @IsOptional()
  @IsString()
  message?: string;
}
