import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class CreateAttendanceFromQuoteDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  amount?: number;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
