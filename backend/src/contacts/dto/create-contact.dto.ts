import { IsOptional, IsString } from 'class-validator';

export class CreateContactDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() commune?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() source?: string;
}
