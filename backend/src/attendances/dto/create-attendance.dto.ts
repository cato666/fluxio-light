import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class CreateAttendanceDto {
  @IsString() title!: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() amount!: number;
  @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
}
