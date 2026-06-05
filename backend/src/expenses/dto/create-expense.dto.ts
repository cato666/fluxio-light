import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateExpenseDto {
  @IsString() description!: string;
  @IsInt() amount!: number;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() attendanceId?: string;
}
