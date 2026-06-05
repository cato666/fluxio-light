import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  list(professionalId: string) {
    return this.prisma.contact.findMany({
      where: { professionalId },
      orderBy: { createdAt: 'desc' }
    });
  }

  get(professionalId: string, id: string) {
    return this.prisma.contact.findFirst({ where: { id, professionalId } });
  }

  async get360(professionalId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, professionalId },
      include: {
        leads: { orderBy: { updatedAt: 'desc' } },
        quotes: { orderBy: { updatedAt: 'desc' }, include: { lead: true, attendance: true } },
        appointments: { orderBy: { startsAt: 'desc' } },
        attendances: {
          orderBy: { performedAt: 'desc' },
          include: {
            incomeRecord: true,
            expenses: { orderBy: { spentAt: 'desc' } },
            evidenceFiles: { orderBy: { createdAt: 'desc' } },
            quote: true
          }
        },
        incomeRecords: { orderBy: { createdAt: 'desc' }, include: { attendance: true } },
        expenses: { orderBy: { spentAt: 'desc' }, include: { attendance: true, lead: true } },
        evidenceFiles: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!contact) return null;

    const normalizedPhone = this.normalizePhone(contact.phone);
    const conversations = normalizedPhone
      ? (await this.prisma.whatsAppConversation.findMany({
        where: { professionalId },
        orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 8,
            include: { evidenceFiles: true }
          },
          evidenceFiles: {
            orderBy: { createdAt: 'desc' },
            take: 6
          }
        }
      })).filter((conversation) => this.normalizePhone(conversation.contactPhone) === normalizedPhone)
      : [];

    const incomeTotal = contact.incomeRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidIncomeTotal = contact.incomeRecords
      .filter((item) => item.paymentStatus === 'PAID')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const pendingIncomeTotal = contact.incomeRecords
      .filter((item) => item.paymentStatus !== 'PAID')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expensesTotal = contact.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const quotedTotal = contact.quotes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const convertedQuotedTotal = contact.quotes
      .filter((item) => item.status === 'CONVERTED')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      ...contact,
      conversations,
      summary: {
        leadsCount: contact.leads.length,
        quotesCount: contact.quotes.length,
        acceptedQuotesCount: contact.quotes.filter((item) => item.status === 'ACCEPTED').length,
        attendancesCount: contact.attendances.length,
        appointmentsCount: contact.appointments.length,
        evidenceCount: contact.evidenceFiles.length,
        incomeTotal,
        paidIncomeTotal,
        pendingIncomeTotal,
        expensesTotal,
        profitEstimate: incomeTotal - expensesTotal,
        quotedTotal,
        convertedQuotedTotal
      }
    };
  }

  create(professionalId: string, dto: CreateContactDto) {
    return this.prisma.contact.create({
      data: { ...dto, professionalId } as any
    });
  }

  update(professionalId: string, id: string, dto: Partial<CreateContactDto>) {
    return this.prisma.contact.updateMany({
      where: { id, professionalId },
      data: dto as any
    });
  }

  remove(professionalId: string, id: string) {
    return this.prisma.contact.deleteMany({ where: { id, professionalId } });
  }

  private normalizePhone(value?: string | null) {
    return (value || '').replace(/[^\d]/g, '');
  }
}
