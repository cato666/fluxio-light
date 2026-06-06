import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateAttendanceFromAppointmentDto } from './dto/create-attendance-from-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  list(professionalId: string) {
    return this.prisma.appointment.findMany({
      where: { professionalId },
      include: { contact: true, attendance: true },
      orderBy: { startsAt: 'desc' }
    });
  }

  get(professionalId: string, id: string) {
    return this.prisma.appointment.findFirst({
      where: { id, professionalId },
      include: { contact: true, attendance: { include: { incomeRecord: true } } }
    });
  }

  create(professionalId: string, dto: CreateAppointmentDto) {
    return this.prisma.appointment.create({
      data: { ...dto, professionalId } as any
    });
  }

  async update(professionalId: string, id: string, dto: UpdateAppointmentDto) {
    const appointment = await this.prisma.appointment.findFirst({ where: { id, professionalId } });
    if (!appointment) throw new NotFoundException('Appointment not found.');

    return this.prisma.appointment.update({
      where: { id: appointment.id },
      data: dto as any,
      include: { contact: true, attendance: true }
    });
  }

  async createAttendance(professionalId: string, id: string, dto: CreateAttendanceFromAppointmentDto) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, professionalId },
      include: { attendance: true }
    });
    if (!appointment) throw new NotFoundException('Appointment not found.');
    if (appointment.attendance) throw new BadRequestException('Appointment already has an attendance.');
    if (appointment.status === 'CANCELLED') throw new BadRequestException('Cancelled appointment cannot be completed.');

    const paymentStatus = dto.paymentStatus || 'PENDING';
    const title = dto.title || appointment.title;
    const description = dto.description || appointment.description;

    return this.prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.create({
        data: {
          professionalId,
          appointmentId: appointment.id,
          contactId: appointment.contactId,
          title,
          description,
          amount: dto.amount
        }
      });
      const incomeRecord = await tx.incomeRecord.create({
        data: {
          professionalId,
          attendanceId: attendance.id,
          contactId: appointment.contactId,
          description: title,
          amount: dto.amount,
          paymentStatus,
          paymentMethod: dto.paymentMethod || 'OTHER',
          paidAt: paymentStatus === 'PAID' ? new Date() : null
        }
      });
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: 'COMPLETED' }
      });
      return { attendance, incomeRecord };
    });
  }

  async remove(professionalId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, professionalId },
      include: { attendance: true, evidenceFiles: true }
    });
    if (!appointment) throw new NotFoundException('Appointment not found.');
    if (appointment.attendance || appointment.evidenceFiles.length > 0) {
      throw new BadRequestException('Appointment with attendance or evidence cannot be deleted. Cancel it instead.');
    }
    return this.prisma.appointment.delete({ where: { id: appointment.id } });
  }
}
