import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateQuoteDto {
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() amount?: number;
  @IsOptional() @IsInt() @Min(1) @Max(90) validityDays?: number;
  @IsOptional() @IsString() paymentTerms?: string;
  @IsOptional() @IsString() observations?: string;
}
