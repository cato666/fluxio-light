import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class CreateIncomeDto {
  @IsString() description!: string;
  @IsInt() amount!: number;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
}
