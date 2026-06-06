import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async summary(professionalId: string) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      income,
      paidIncome,
      expenses,
      attendances,
      leads,
      openLeads,
      pending,
      recentAttendances,
      quotes,
      quoteTotals,
      convertedQuotes,
      todayAppointments,
      pendingQuotes,
      recentConversations
    ] = await Promise.all([
      this.prisma.incomeRecord.aggregate({
        where: { professionalId, createdAt: { gte: start, lt: end } },
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.incomeRecord.aggregate({
        where: { professionalId, paymentStatus: 'PAID', createdAt: { gte: start, lt: end } },
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.expense.aggregate({
        where: { professionalId, createdAt: { gte: start, lt: end } },
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.attendance.count({ where: { professionalId, performedAt: { gte: start, lt: end } } }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: { professionalId, createdAt: { gte: start, lt: end } },
        _count: true
      }),
      this.prisma.lead.count({
        where: { professionalId, status: { in: ['NEW', 'CONTACTED', 'SCHEDULED'] } }
      }),
      this.prisma.incomeRecord.aggregate({
        where: { professionalId, paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.attendance.findMany({
        where: { professionalId },
        orderBy: { performedAt: 'desc' },
        take: 5,
        include: { contact: true, incomeRecord: true }
      }),
      this.prisma.quote.groupBy({
        by: ['status'],
        where: { professionalId, createdAt: { gte: start, lt: end } },
        _count: true,
        _sum: { amount: true }
      }),
      this.prisma.quote.aggregate({
        where: { professionalId, createdAt: { gte: start, lt: end } },
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.quote.aggregate({
        where: { professionalId, status: 'CONVERTED', convertedAt: { gte: start, lt: end } },
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.appointment.findMany({
        where: {
          professionalId,
          startsAt: { gte: todayStart, lt: todayEnd },
          status: { in: ['SCHEDULED', 'COMPLETED'] }
        },
        orderBy: { startsAt: 'asc' },
        include: { contact: true }
      }),
      this.prisma.quote.findMany({
        where: {
          professionalId,
          status: { in: ['DRAFT', 'PENDING_CONFIRMATION', 'SENT'] }
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { contact: true }
      }),
      this.prisma.whatsAppConversation.findMany({
        where: { professionalId },
        orderBy: { lastMessageAt: 'desc' },
        take: 20,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      })
    ]);

    const incomeTotal = income._sum.amount || 0;
    const expensesTotal = expenses._sum.amount || 0;
    const profitEstimate = incomeTotal - expensesTotal;
    const leadsByStatus = leads.map((item) => ({
      status: item.status,
      count: item._count
    }));
    const newLeadsCount = leadsByStatus.find((item) => item.status === 'NEW')?.count || 0;
    const quotesByStatus = quotes.map((item) => ({
      status: item.status,
      count: item._count,
      amount: item._sum.amount || 0
    }));
    const sentQuotesCount = quotesByStatus.find((item) => item.status === 'SENT')?.count || 0;
    const acceptedQuotesCount = quotesByStatus.find((item) => item.status === 'ACCEPTED')?.count || 0;
    const rejectedQuotesCount = quotesByStatus.find((item) => item.status === 'REJECTED')?.count || 0;
    const convertedQuotesCount = quotesByStatus.find((item) => item.status === 'CONVERTED')?.count || 0;
    const quoteDecisionCount = acceptedQuotesCount + rejectedQuotesCount + convertedQuotesCount;

    return {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      incomeTotal,
      incomeCount: income._count,
      paidIncomeTotal: paidIncome._sum.amount || 0,
      paidIncomeCount: paidIncome._count,
      expensesTotal,
      expensesCount: expenses._count,
      profitEstimate,
      profitMarginPercent: incomeTotal > 0 ? Math.round((profitEstimate / incomeTotal) * 100) : 0,
      attendancesCount: attendances,
      leadsByStatus,
      openLeadsCount: openLeads,
      newLeadsCount,
      pendingPaymentTotal: pending._sum.amount || 0,
      pendingPaymentCount: pending._count,
      quoteTotal: quoteTotals._sum.amount || 0,
      quoteCount: quoteTotals._count,
      sentQuotesCount,
      acceptedQuotesCount,
      rejectedQuotesCount,
      convertedQuotesCount: convertedQuotes._count || convertedQuotesCount,
      convertedQuoteTotal: convertedQuotes._sum.amount || 0,
      quoteAcceptanceRatePercent: quoteDecisionCount > 0 ? Math.round(((acceptedQuotesCount + convertedQuotesCount) / quoteDecisionCount) * 100) : 0,
      quotesByStatus,
      today: {
        appointments: todayAppointments.map((appointment) => ({
          id: appointment.id,
          title: appointment.title,
          startsAt: appointment.startsAt,
          status: appointment.status,
          location: appointment.location,
          contactName: appointment.contact?.fullName,
          contactPhone: appointment.contact?.phone
        })),
        pendingQuotes: pendingQuotes.map((quote) => ({
          id: quote.id,
          title: quote.title,
          amount: quote.amount,
          status: quote.status,
          contactName: quote.contact?.fullName,
          contactPhone: quote.contact?.phone
        })),
        conversationsToReply: recentConversations
          .filter((conversation) => conversation.messages[0]?.direction === 'INBOUND')
          .slice(0, 5)
          .map((conversation) => ({
            id: conversation.id,
            contactName: conversation.contactName,
            contactPhone: conversation.contactPhone,
            lastMessageAt: conversation.lastMessageAt,
            text: conversation.messages[0]?.text,
            type: conversation.messages[0]?.type
          }))
      },
      recentAttendances: recentAttendances.map((attendance) => ({
        id: attendance.id,
        title: attendance.title,
        amount: attendance.incomeRecord?.amount ?? attendance.amount,
        paymentStatus: attendance.incomeRecord?.paymentStatus,
        contactName: attendance.contact?.fullName,
        contactPhone: attendance.contact?.phone,
        performedAt: attendance.performedAt
      }))
    };
  }
}
