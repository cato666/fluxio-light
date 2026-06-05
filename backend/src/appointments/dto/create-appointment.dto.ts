import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAppointmentDto {
  @IsString() title!: string;
  @IsDateString() startsAt!: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() location?: string;
}
