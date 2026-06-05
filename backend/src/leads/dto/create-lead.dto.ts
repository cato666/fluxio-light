import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { LeadStatus } from '@prisma/client';

export class CreateLeadDto {
  @IsString() title!: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @IsOptional() @IsInt() estimatedValue?: number;
}
