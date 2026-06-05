import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.service.list(user.professionalId);
  }

  @Get(':id')
  get(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.get(user.professionalId, id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateAppointmentDto) {
    return this.service.create(user.professionalId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: Partial<CreateAppointmentDto>) {
    return this.service.update(user.professionalId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.professionalId, id);
  }
}
