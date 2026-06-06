import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateQuoteDto {
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() amount?: number;
}
