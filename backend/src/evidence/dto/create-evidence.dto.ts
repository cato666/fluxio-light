import { EvidenceCategory, EvidenceType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateEvidenceDto {
  @IsOptional() @IsEnum(EvidenceType) type?: EvidenceType;
  @IsOptional() @IsEnum(EvidenceCategory) category?: EvidenceCategory;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() appointmentId?: string;
  @IsOptional() @IsString() attendanceId?: string;
  @IsOptional() @IsString() caption?: string;
}
