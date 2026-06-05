import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateIncomeDto } from './dto/create-income.dto';

@Injectable()
export class IncomeService {
  constructor(private prisma: PrismaService) {}

  list(professionalId: string) {
    return this.prisma.incomeRecord.findMany({
      where: { professionalId },
      include: {
        contact: true,
        attendance: {
          include: {
            contact: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  get(professionalId: string, id: string) {
    return this.prisma.incomeRecord.findFirst({
      where: { id, professionalId },
      include: {
        contact: true,
        attendance: {
          include: {
            contact: true
          }
        }
      }
    });
  }

  create(professionalId: string, dto: CreateIncomeDto) {
    return this.prisma.incomeRecord.create({
      data: { ...dto, professionalId } as any
    });
  }

  async update(professionalId: string, id: string, dto: Partial<CreateIncomeDto>) {
    const income = await this.prisma.incomeRecord.findFirst({
      where: { id, professionalId }
    });

    if (!income) {
      return { count: 0 };
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.incomeRecord.update({
        where: { id: income.id },
        data: dto as any,
        include: {
          contact: true,
          attendance: {
            include: {
              contact: true
            }
          }
        }
      });

      if (income.attendanceId && dto.amount !== undefined) {
        await tx.attendance.update({
          where: { id: income.attendanceId },
          data: { amount: dto.amount }
        });
      }

      return updated;
    });
  }

  remove(professionalId: string, id: string) {
    return this.prisma.incomeRecord.deleteMany({ where: { id, professionalId } });
  }
}
