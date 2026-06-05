import { IsInt, IsOptional, IsString } from 'class-validator';

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
}
