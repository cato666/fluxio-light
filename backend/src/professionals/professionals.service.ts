import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ProfessionalsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService
  ) {}

  get(id: string) {
    return this.prisma.professional.findUnique({ where: { id } });
  }

  update(id: string, data: any) {
    const allowed = [
      'displayName',
      'profession',
      'phone',
      'assistantAllowedPhones',
      'email',
      'timezone',
      'currency'
    ];
    const clean = Object.fromEntries(
      Object.entries(data || {}).filter(([key]) => allowed.includes(key))
    );

    return this.prisma.professional.update({ where: { id }, data: clean });
  }

  async demoMode(id: string) {
    const demoPhone = '+56922222222';
    const demoSource = 'Fluxio Demo';
    const demoService = 'Curacion simple a domicilio';
    const [professional, contact, quote, appointment, attendance, conversation] = await Promise.all([
      this.prisma.professional.findUnique({ where: { id } }),
      this.prisma.contact.findFirst({
        where: { professionalId: id, source: demoSource, phone: demoPhone },
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.quote.findFirst({
        where: {
          professionalId: id,
          title: demoService,
          description: { contains: 'demo', mode: 'insensitive' }
        },
        orderBy: { updatedAt: 'desc' },
        include: { contact: true, attendance: true }
      }),
      this.prisma.appointment.findFirst({
        where: { professionalId: id, title: `Demo - ${demoService}` },
        orderBy: { startsAt: 'asc' }
      }),
      this.prisma.attendance.findFirst({
        where: { professionalId: id, title: `Demo - ${demoService}` },
        orderBy: { performedAt: 'desc' },
        include: { contact: true, incomeRecord: true, expenses: true, quote: true }
      }),
      this.prisma.whatsAppConversation.findFirst({
        where: { professionalId: id, contactPhone: demoPhone },
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 8
          }
        }
      })
    ]);

    const hasDemoData = Boolean(contact || quote || appointment || attendance || conversation);
    const fluxioPhone =
      this.config.get<string>('KAPSO_PLATFORM_PHONE_DISPLAY') ||
      this.config.get<string>('KAPSO_SANDBOX_PHONE_NUMBER_ID') ||
      '+56920403095';

    return {
      enabled: hasDemoData,
      professional: professional
        ? {
            id: professional.id,
            displayName: professional.displayName,
            phone: professional.phone,
            assistantAllowedPhones: professional.assistantAllowedPhones
          }
        : null,
      fluxioPhone,
      demo: {
        contact,
        quote,
        appointment,
        attendance,
        conversation
      },
      commands: [
        { label: 'Menu principal', text: 'menu' },
        { label: 'Cotizar demo', text: 'Cotizar: Ana Perez, curacion a domicilio, $25000' },
        { label: 'Agenda', text: 'Agenda de hoy' },
        { label: 'Pendientes', text: 'Pendientes de cobro' },
        { label: 'Cobrar', text: 'Cobrar a Ana Perez' }
      ]
    };
  }

  async realStart(id: string) {
    const realWhere = this.realWhere();
    const [contacts, leads, quotes, attendances, incomeRecords, conversations, latestRealContact] = await Promise.all([
      this.prisma.contact.count({ where: { professionalId: id, ...realWhere.contact } }),
      this.prisma.lead.count({ where: { professionalId: id, ...realWhere.lead } }),
      this.prisma.quote.count({ where: { professionalId: id, ...realWhere.quote } }),
      this.prisma.attendance.count({ where: { professionalId: id, ...realWhere.attendance } }),
      this.prisma.incomeRecord.count({ where: { professionalId: id, ...realWhere.incomeRecord } }),
      this.prisma.whatsAppConversation.count({ where: { professionalId: id, ...realWhere.conversation } }),
      this.prisma.contact.findFirst({
        where: { professionalId: id, ...realWhere.contact },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const steps = [
      {
        key: 'real_contact',
        title: 'Crear primer cliente real',
        done: contacts > 0,
        description: 'Registra un cliente fuera del modo demo.',
        action: 'create_contact'
      },
      {
        key: 'real_quote',
        title: 'Preparar primera cotizacion real',
        done: quotes > 0,
        description: 'Crea o envia una cotizacion asociada a un cliente real.',
        action: 'go_quotes'
      },
      {
        key: 'real_attendance',
        title: 'Registrar primera atencion real',
        done: attendances > 0,
        description: 'Convierte una cotizacion o registra una atencion real.',
        action: 'go_attendances'
      },
      {
        key: 'real_payment',
        title: 'Registrar primer pago o pendiente',
        done: incomeRecords > 0,
        description: 'Deja trazabilidad de pago, pendiente o parcial.',
        action: 'go_income'
      },
      {
        key: 'real_whatsapp',
        title: 'Tener conversacion real por WhatsApp',
        done: conversations > 0,
        description: 'Recibe o responde un chat que no sea demo.',
        action: 'go_whatsapp'
      }
    ];

    const completed = steps.filter((step) => step.done).length;
    return {
      ready: completed === steps.length,
      completed,
      total: steps.length,
      nextStep: steps.find((step) => !step.done) || null,
      counts: {
        contacts,
        leads,
        quotes,
        attendances,
        incomeRecords,
        conversations
      },
      latestRealContact,
      steps
    };
  }

  private realWhere() {
    const demoPhone = '+56922222222';
    const demoPhoneNormalized = '56922222222';
    const demoService = 'Curacion simple a domicilio';
    return {
      contact: {
        NOT: [
          { source: 'Fluxio Demo' },
          { phone: demoPhone },
          { phone: demoPhoneNormalized }
        ]
      },
      lead: {
        NOT: [
          { source: 'Fluxio Demo' },
          { title: demoService }
        ]
      },
      quote: {
        NOT: [
          { title: demoService },
          { description: { contains: 'demo', mode: 'insensitive' as const } },
          { contact: { is: { source: 'Fluxio Demo' } } }
        ]
      },
      attendance: {
        NOT: [
          { title: `Demo - ${demoService}` },
          { description: { contains: 'demo', mode: 'insensitive' as const } },
          { contact: { is: { source: 'Fluxio Demo' } } }
        ]
      },
      incomeRecord: {
        NOT: [
          { description: { startsWith: 'Ingreso demo' } },
          { contact: { is: { source: 'Fluxio Demo' } } },
          { attendance: { is: { title: `Demo - ${demoService}` } } }
        ]
      },
      conversation: {
        NOT: [
          { contactPhone: demoPhone },
          { contactPhone: demoPhoneNormalized },
          { contactName: 'Ana Perez' }
        ]
      }
    };
  }
}
