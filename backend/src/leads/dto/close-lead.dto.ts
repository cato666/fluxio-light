import { LeadStatus } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class CloseLeadDto {
  @IsEnum(LeadStatus)
  status!: LeadStatus;

  @IsString()
  reason!: string;
}
