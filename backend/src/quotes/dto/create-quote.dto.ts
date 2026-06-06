import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateQuoteDto {
  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  validityDays?: number;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
