import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { CreateExpenseDto } from '../expenses/dto/create-expense.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@Injectable()
export class AttendancesService {
  constructor(private prisma: PrismaService) {}

  list(professionalId: string) {
    return this.prisma.attendance.findMany({
      where: { professionalId },
      include: { contact: true, incomeRecord: true, evidenceFiles: true, expenses: true },
      orderBy: { performedAt: 'desc' }
    });
  }

  async get(professionalId: string, id: string) {
    const attendance = await this.prisma.attendance.findFirst({
      where: { id, professionalId },
      include: {
        contact: true,
        incomeRecord: true,
        evidenceFiles: {
          orderBy: { createdAt: 'desc' }
        },
        expenses: {
          orderBy: { spentAt: 'desc' }
        }
      }
    });

    if (!attendance) throw new NotFoundException('Attendance not found.');

    const expensesTotal = attendance.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const incomeAmount = attendance.incomeRecord?.amount ?? attendance.amount;

    return {
      ...attendance,
      expensesTotal,
      profitEstimate: incomeAmount - expensesTotal
    };
  }

  async create(professionalId: string, dto: CreateAttendanceDto) {
    return this.prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.create({
        data: {
          professionalId,
          contactId: dto.contactId,
          title: dto.title,
          description: dto.description,
          amount: dto.amount
        }
      });

      await tx.incomeRecord.create({
        data: {
          professionalId,
          contactId: dto.contactId,
          attendanceId: attendance.id,
          description: dto.title,
          amount: dto.amount,
          paymentStatus: dto.paymentStatus || 'PAID',
          paymentMethod: dto.paymentMethod || 'OTHER',
          paidAt: dto.paymentStatus === 'PENDING' ? null : new Date()
        }
      });

      return tx.attendance.findUnique({
        where: { id: attendance.id },
        include: { incomeRecord: true, contact: true }
      });
    });
  }

  async addExpense(professionalId: string, attendanceId: string, dto: CreateExpenseDto) {
    const attendance = await this.prisma.attendance.findFirst({
      where: { id: attendanceId, professionalId }
    });

    if (!attendance) throw new NotFoundException('Attendance not found.');

    const expense = await this.prisma.expense.create({
      data: {
        professionalId,
        attendanceId: attendance.id,
        contactId: dto.contactId || attendance.contactId,
        leadId: dto.leadId,
        description: dto.description,
        amount: dto.amount,
        category: dto.category
      }
    });

    return {
      expense,
      attendance: await this.get(professionalId, attendance.id)
    };
  }

  async update(professionalId: string, id: string, dto: UpdateAttendanceDto) {
    const attendance = await this.prisma.attendance.findFirst({
      where: { id, professionalId },
      include: { incomeRecord: true }
    });
    if (!attendance) throw new NotFoundException('Attendance not found.');

    const { paymentStatus, paymentMethod, ...attendanceData } = dto;
    return this.prisma.$transaction(async (tx) => {
      await tx.attendance.update({
        where: { id: attendance.id },
        data: attendanceData
      });
      if (attendance.incomeRecord) {
        await tx.incomeRecord.update({
          where: { id: attendance.incomeRecord.id },
          data: {
            contactId: dto.contactId,
            description: dto.title,
            amount: dto.amount,
            paymentStatus,
            paymentMethod,
            paidAt: paymentStatus === 'PAID' ? new Date() : paymentStatus ? null : undefined
          }
        });
      }
      return tx.attendance.findUnique({
        where: { id: attendance.id },
        include: { contact: true, incomeRecord: true, expenses: true, evidenceFiles: true }
      });
    });
  }

  async remove(professionalId: string, id: string) {
    const attendance = await this.prisma.attendance.findFirst({
      where: { id, professionalId },
      include: { expenses: true, evidenceFiles: true, incomeRecord: true, quote: true, appointment: true }
    });
    if (!attendance) throw new NotFoundException('Attendance not found.');
    if (attendance.expenses.length || attendance.evidenceFiles.length) {
      throw new BadRequestException('Attendance with expenses or evidence cannot be deleted. Cancel it instead.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (attendance.incomeRecord) {
        await tx.incomeRecord.delete({ where: { id: attendance.incomeRecord.id } });
      }
      if (attendance.quote) {
        await tx.quote.update({
          where: { id: attendance.quote.id },
          data: { status: 'ACCEPTED', convertedAt: null }
        });
      }
      if (attendance.appointment) {
        await tx.appointment.update({
          where: { id: attendance.appointment.id },
          data: { status: 'SCHEDULED' }
        });
      }
      return tx.attendance.delete({ where: { id: attendance.id } });
    });
  }
}
