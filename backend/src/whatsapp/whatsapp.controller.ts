import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WhatsappService } from './whatsapp.service';
import { ReplyConversationDto } from './dto/reply-conversation.dto';

@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly service: WhatsappService) {}

  @Get('conversations')
  listConversations(@CurrentUser() user: any) {
    return this.service.listConversations(user.professionalId);
  }

  @Get('conversations/:id')
  getConversation(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getConversation(user.professionalId, id);
  }

  @Post('conversations/:id/reply')
  reply(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ReplyConversationDto) {
    return this.service.reply(user.professionalId, id, dto.body);
  }
}
