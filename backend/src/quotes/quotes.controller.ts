import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateAttendanceFromQuoteDto } from './dto/create-attendance-from-quote.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteStatusDto } from './dto/update-quote-status.dto';
import { QuotesService } from './quotes.service';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { SendQuoteDocumentDto } from './dto/send-quote-document.dto';

@UseGuards(JwtAuthGuard)
@Controller('quotes')
export class QuotesController {
  constructor(private readonly service: QuotesService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.service.list(user.professionalId);
  }

  @Get(':id')
  get(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.get(user.professionalId, id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateQuoteDto) {
    return this.service.create(user.professionalId, dto);
  }

  @Post(':id/send')
  send(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.send(user.professionalId, id);
  }

  @Post(':id/document')
  generateDocument(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.generateDocument(user.professionalId, id);
  }

  @Get(':id/documents')
  listDocuments(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.listDocuments(user.professionalId, id);
  }

  @Post(':id/send-document')
  sendDocument(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: SendQuoteDocumentDto) {
    return this.service.sendDocument(user.professionalId, id, dto.recipient);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.service.update(user.professionalId, id, dto);
  }

  @Patch(':id/status')
  updateStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateQuoteStatusDto) {
    return this.service.updateStatus(user.professionalId, id, dto.status);
  }

  @Post(':id/create-attendance')
  createAttendance(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateAttendanceFromQuoteDto) {
    return this.service.createAttendance(user.professionalId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.professionalId, id);
  }
}
