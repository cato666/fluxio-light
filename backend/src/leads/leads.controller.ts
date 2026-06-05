import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { SendQuoteDto } from './dto/send-quote.dto';
import { CreateAttendanceFromLeadDto } from './dto/create-attendance-from-lead.dto';

@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.service.list(user.professionalId);
  }

  @Get(':id')
  get(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.get(user.professionalId, id);
  }

  @Post(':id/send-quote')
  sendQuote(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: SendQuoteDto) {
    return this.service.sendQuote(user.professionalId, id, dto);
  }

  @Post(':id/create-attendance')
  createAttendance(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateAttendanceFromLeadDto) {
    return this.service.createAttendanceFromLead(user.professionalId, id, dto);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateLeadDto) {
    return this.service.create(user.professionalId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: Partial<CreateLeadDto> & any) {
    return this.service.update(user.professionalId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.professionalId, id);
  }
}
