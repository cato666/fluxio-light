import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  list(professionalId: string) {
    return this.prisma.expense.findMany({
      where: { professionalId },
      include: {
        contact: true,
        lead: true,
        attendance: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  get(professionalId: string, id: string) {
    return this.prisma.expense.findFirst({
      where: { id, professionalId },
      include: {
        contact: true,
        lead: true,
        attendance: true
      }
    });
  }

  create(professionalId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: { ...dto, professionalId } as any
    });
  }

  update(professionalId: string, id: string, dto: Partial<CreateExpenseDto>) {
    return this.prisma.expense.updateMany({
      where: { id, professionalId },
      data: dto as any
    });
  }

  remove(professionalId: string, id: string) {
    return this.prisma.expense.deleteMany({ where: { id, professionalId } });
  }
}
