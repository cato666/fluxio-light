import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.service.list(user.professionalId);
  }

  @Get(':id/360')
  get360(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.get360(user.professionalId, id);
  }

  @Get(':id')
  get(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.get(user.professionalId, id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateContactDto) {
    return this.service.create(user.professionalId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: Partial<CreateContactDto>) {
    return this.service.update(user.professionalId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.professionalId, id);
  }
}
