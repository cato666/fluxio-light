import { IsString } from 'class-validator';

export class SendWhatsAppMessageDto {
  @IsString() phoneNumberId!: string;
  @IsString() to!: string;
  @IsString() body!: string;
}
