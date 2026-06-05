import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { CreateExpenseDto } from '../expenses/dto/create-expense.dto';

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
}
