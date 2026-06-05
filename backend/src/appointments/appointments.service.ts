import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  list(professionalId: string) {
    return this.prisma.appointment.findMany({
      where: { professionalId },
      orderBy: { createdAt: 'desc' }
    });
  }

  get(professionalId: string, id: string) {
    return this.prisma.appointment.findFirst({ where: { id, professionalId } });
  }

  create(professionalId: string, dto: CreateAppointmentDto) {
    return this.prisma.appointment.create({
      data: { ...dto, professionalId } as any
    });
  }

  update(professionalId: string, id: string, dto: Partial<CreateAppointmentDto>) {
    return this.prisma.appointment.updateMany({
      where: { id, professionalId },
      data: dto as any
    });
  }

  remove(professionalId: string, id: string) {
    return this.prisma.appointment.deleteMany({ where: { id, professionalId } });
  }
}
