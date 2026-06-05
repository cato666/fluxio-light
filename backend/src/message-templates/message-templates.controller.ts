import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MessageTemplatesService } from './message-templates.service';

@UseGuards(JwtAuthGuard)
@Controller('message-templates')
export class MessageTemplatesController {
  constructor(private readonly service: MessageTemplatesService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.service.list(user.professionalId);
  }

  @Post('defaults')
  ensureDefaults(@CurrentUser() user: any) {
    return this.service.ensureDefaults(user.professionalId);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.service.update(user.professionalId, id, body);
  }
}
