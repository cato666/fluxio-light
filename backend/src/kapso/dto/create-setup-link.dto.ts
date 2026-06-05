import { IsOptional, IsString } from 'class-validator';

export class CreateSetupLinkDto {
  @IsOptional()
  @IsString()
  reconnectPhoneNumber?: string;
}
