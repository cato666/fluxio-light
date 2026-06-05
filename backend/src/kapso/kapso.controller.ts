import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateSetupLinkDto } from './dto/create-setup-link.dto';
import { SendWhatsAppMessageDto } from './dto/send-whatsapp-message.dto';
import { KapsoService } from './kapso.service';

@UseGuards(JwtAuthGuard)
@Controller('kapso')
export class KapsoController {
  constructor(private readonly kapso: KapsoService) {}

  @Post('setup-link')
  createSetupLink(@CurrentUser() user: any, @Body() dto: CreateSetupLinkDto) {
    return this.kapso.createSetupLink(user.professionalId, dto.reconnectPhoneNumber);
  }

  @Get('status')
  status(@CurrentUser() user: any) {
    return this.kapso.getStatus(user.professionalId);
  }

  @Post('send-message')
  sendMessage(@Body() dto: SendWhatsAppMessageDto) {
    return this.kapso.sendTextMessage(dto.phoneNumberId, dto.to, dto.body);
  }
}
