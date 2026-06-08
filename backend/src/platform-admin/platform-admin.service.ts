import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { KapsoConfigService } from '../kapso/kapso-config.service';
import { KapsoService } from '../kapso/kapso.service';
import { AdminNotificationsService } from '../admin-notifications/admin-notifications.service';

type AccountAction = 'ACTIVE' | 'SUSPENDED' | 'PENDING_APPROVAL';

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly kapsoConfig: KapsoConfigService,
    private readonly kapsoService: KapsoService,
    private readonly adminNotifications: AdminNotificationsService
  ) {}

  async overview() {
    const [
      totalUsers,
      pendingUsers,
      activeUsers,
      suspendedUsers,
      totalMessages,
      inboundMessages,
      totalAuditLogs,
      latestWebhook,
      failedOutboundMessages,
      recentOutboundMessages
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { accountStatus: 'PENDING_APPROVAL' } }),
      this.prisma.user.count({ where: { accountStatus: 'ACTIVE' } }),
      this.prisma.user.count({ where: { accountStatus: 'SUSPENDED' } }),
      this.prisma.whatsAppMessage.count(),
      this.prisma.whatsAppMessage.count({ where: { direction: 'INBOUND' } }),
      this.prisma.auditLog.count(),
      this.prisma.auditLog.findFirst({
        where: { action: { contains: 'KAPSO' } },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.whatsAppMessage.count({
        where: { direction: 'OUTBOUND', outboundStatus: 'FAILED' }
      }),
      this.prisma.whatsAppMessage.count({
        where: { direction: 'OUTBOUND' }
      })
    ]);

    return {
      users: {
        total: totalUsers,
        pending: pendingUsers,
        active: activeUsers,
        suspended: suspendedUsers
      },
      whatsapp: {
        totalMessages,
        inboundMessages,
        outboundMessages: recentOutboundMessages,
        failedOutboundMessages
      },
      audit: {
        total: totalAuditLogs,
        latestWebhookAt: latestWebhook?.createdAt || null,
        latestWebhookAction: latestWebhook?.action || null
      },
      platform: {
        phoneDisplay: this.config.get<string>('KAPSO_PLATFORM_PHONE_DISPLAY') || null,
        mode: this.config.get<string>('KAPSO_MODE') || 'sandbox'
      }
    };
  }

  async invitations() {
    await this.expireOldInvitations();
    const rows = await this.prisma.professionalInvitation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        acceptedUser: {
          select: {
            id: true,
            email: true,
            name: true,
            accountStatus: true,
            professional: {
              select: {
                id: true,
                displayName: true
              }
            }
          }
        }
      }
    });

    return rows.map((row) => this.withInvitationDelivery(row));
  }

  async createInvitation(data: any) {
    const email = String(data?.email || '').trim().toLowerCase();
    const displayName = String(data?.displayName || '').trim();
    if (!email || !displayName) throw new BadRequestException('Email y nombre son obligatorios.');

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new BadRequestException('Ya existe un usuario con ese email.');

    const existingPending = await this.prisma.professionalInvitation.findFirst({
      where: { email, status: 'PENDING', expiresAt: { gt: new Date() } }
    });
    if (existingPending) {
      return this.withInvitationDelivery(existingPending);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(data?.expiresInDays || 14));
    const invitation = await this.prisma.professionalInvitation.create({
      data: {
        email,
        displayName,
        profession: data?.profession?.trim() || null,
        phone: data?.phone?.trim() || null,
        note: data?.note?.trim() || null,
        token: randomBytes(24).toString('hex'),
        expiresAt
      }
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'PLATFORM_ADMIN_CREATED_PROFESSIONAL_INVITATION',
        entity: 'ProfessionalInvitation',
        entityId: invitation.id,
        metadata: {
          email,
          displayName,
          expiresAt
        }
      }
    });

    return this.withInvitationDelivery(invitation);
  }

  async cancelInvitation(id: string) {
    const invitation = await this.prisma.professionalInvitation.findUnique({ where: { id } });
    if (!invitation) throw new NotFoundException('Invitacion no encontrada.');
    if (invitation.status !== 'PENDING') return invitation;

    const updated = await this.prisma.professionalInvitation.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });
    await this.prisma.auditLog.create({
      data: {
        action: 'PLATFORM_ADMIN_CANCELLED_PROFESSIONAL_INVITATION',
        entity: 'ProfessionalInvitation',
        entityId: id,
        metadata: { email: invitation.email }
      }
    });

    return this.withInvitationDelivery(updated);
  }

  async professionals(query = '') {
    const search = query.trim();
    const users = await this.prisma.user.findMany({
      where: search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              { professional: { displayName: { contains: search, mode: 'insensitive' } } },
              { professional: { phone: { contains: search, mode: 'insensitive' } } },
              { professional: { assistantAllowedPhones: { contains: search, mode: 'insensitive' } } }
            ]
          }
        : undefined,
      include: {
        professional: {
          include: {
            _count: {
              select: {
                contacts: true,
                leads: true,
                quotes: true,
                attendances: true,
                messages: true,
                conversations: true,
                messageTemplates: true
              }
            },
            whatsappConnections: {
              orderBy: { updatedAt: 'desc' },
              take: 3
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const professionalIds = users.map((user) => user.professional?.id).filter(Boolean) as string[];
    const latestAuditLogs = professionalIds.length
      ? await this.prisma.auditLog.findMany({
          where: { professionalId: { in: professionalIds } },
          orderBy: { createdAt: 'desc' },
          take: 300
        })
      : [];
    const latestAuditByProfessional = new Map<string, any>();
    for (const row of latestAuditLogs) {
      if (row.professionalId && !latestAuditByProfessional.has(row.professionalId)) {
        latestAuditByProfessional.set(row.professionalId, row);
      }
    }
    const messages = professionalIds.length
      ? await this.prisma.whatsAppMessage.findMany({
          where: { professionalId: { in: professionalIds } },
          orderBy: { createdAt: 'desc' },
          take: 1000
        })
      : [];
    const latestInboundByProfessional = new Map<string, any>();
    const latestOutboundByProfessional = new Map<string, any>();
    const failedOutboundByProfessional = new Map<string, number>();
    for (const message of messages) {
      if (message.direction === 'INBOUND' && !latestInboundByProfessional.has(message.professionalId)) {
        latestInboundByProfessional.set(message.professionalId, message);
      }
      if (message.direction === 'OUTBOUND' && !latestOutboundByProfessional.has(message.professionalId)) {
        latestOutboundByProfessional.set(message.professionalId, message);
      }
      if (message.direction === 'OUTBOUND' && message.outboundStatus === 'FAILED') {
        failedOutboundByProfessional.set(message.professionalId, (failedOutboundByProfessional.get(message.professionalId) || 0) + 1);
      }
    }

    return users.map((user) => {
      const professional = user.professional;
      const latestAudit = professional ? latestAuditByProfessional.get(professional.id) : null;
      const latestInbound = professional ? latestInboundByProfessional.get(professional.id) : null;
      const latestOutbound = professional ? latestOutboundByProfessional.get(professional.id) : null;
      const activationChecklist = professional
        ? this.buildActivationChecklist({
            accountActive: user.accountStatus === 'ACTIVE',
            profileComplete: Boolean(professional.displayName && professional.profession && professional.phone),
            commandPhonesReady: this.parsePhones(professional.phone, professional.assistantAllowedPhones).length > 0,
            fluxioPhoneReady: Boolean(this.config.get<string>('KAPSO_PLATFORM_PHONE_DISPLAY') || professional.whatsappConnections[0]?.displayPhone || this.config.get<string>('KAPSO_SANDBOX_PHONE_NUMBER_ID')),
            firstInboundReady: Boolean(latestInbound || latestAudit),
            outboundReady: Boolean(latestOutbound && latestOutbound.outboundStatus !== 'FAILED'),
            templatesReady: (professional._count as any).messageTemplates >= 4
          })
        : [];
      const activationSummary = this.activationSummary(activationChecklist);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        accountStatus: user.accountStatus,
        approvedAt: user.approvedAt,
        createdAt: user.createdAt,
        professional: professional
          ? {
              id: professional.id,
              displayName: professional.displayName,
              profession: professional.profession,
              phone: professional.phone,
              assistantAllowedPhones: professional.assistantAllowedPhones,
              email: professional.email,
              kapsoCustomerId: professional.kapsoCustomerId,
              counts: professional._count,
              whatsappConnections: professional.whatsappConnections.map((connection) => ({
                id: connection.id,
                status: connection.status,
                phoneNumberId: connection.phoneNumberId,
                displayPhone: connection.displayPhone,
                connectionType: connection.connectionType,
                lastError: connection.lastError,
                updatedAt: connection.updatedAt
              })),
              latestActivityAt: latestAudit?.createdAt || null,
              latestActivity: latestAudit?.action || null,
              lastInboundAt: latestInbound?.createdAt || null,
              lastOutboundAt: latestOutbound?.createdAt || null,
              lastOutboundStatus: latestOutbound?.outboundStatus || null,
              failedOutboundCount: failedOutboundByProfessional.get(professional.id) || 0,
              activationChecklist,
              activationCompleted: activationSummary.completed,
              activationTotal: activationSummary.total,
              activationStatus: activationSummary.status,
              readyForDemo: activationSummary.readyForDemo,
              nextActivationStep: activationSummary.nextStep
            }
          : null
      };
    });
  }

  async updateAccountStatus(userId: string, status: AccountAction) {
    if (!['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL'].includes(status)) {
      throw new BadRequestException('Estado de cuenta invalido.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { professional: true }
    });
    if (!existing) throw new NotFoundException('Usuario no encontrado.');
    if (status === 'ACTIVE' && existing.professional) {
      const conflicts = await this.findPhoneConflicts(existing.professional.id);
      if (conflicts.length > 0) {
        throw new BadRequestException({
          message: 'No se puede aprobar la cuenta porque tiene telefonos autorizados duplicados.',
          conflicts
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: status,
        approvedAt: status === 'ACTIVE' ? existing.approvedAt || new Date() : existing.approvedAt
      },
      select: {
        id: true,
        email: true,
        name: true,
        accountStatus: true,
        approvedAt: true
      }
    });

    await this.prisma.auditLog.create({
      data: {
        professionalId: existing.professional?.id || null,
        action: 'PLATFORM_ADMIN_UPDATED_ACCOUNT_STATUS',
        entity: 'User',
        entityId: userId,
        metadata: {
          email: existing.email,
          previousStatus: existing.accountStatus,
          nextStatus: status
        }
      }
    });

    await this.adminNotifications.notify({
      type: 'PROFESSIONAL_ACCOUNT_STATUS_CHANGED',
      severity: status === 'ACTIVE' ? 'info' : 'warning',
      title: status === 'ACTIVE' ? 'Profesional aprobado' : 'Estado de profesional actualizado',
      message: `La cuenta cambio de ${existing.accountStatus} a ${status}.`,
      professionalId: existing.professional?.id || null,
      entity: 'User',
      entityId: userId,
      adminPath: '/?page=platform-admin',
      metadata: {
        email: existing.email,
        professionalName: existing.professional?.displayName || existing.name,
        phone: existing.professional?.phone,
        previousStatus: existing.accountStatus,
        status
      }
    });

    return updated;
  }

  async professionalDetail(professionalId: string) {
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            accountStatus: true,
            approvedAt: true,
            createdAt: true,
            acceptedInvitations: {
              orderBy: { acceptedAt: 'desc' },
              take: 1
            }
          }
        },
        whatsappConnections: {
          orderBy: { updatedAt: 'desc' },
          take: 5
        },
        contacts: {
          orderBy: { updatedAt: 'desc' },
          take: 8
        },
        conversations: {
          orderBy: { lastMessageAt: 'desc' },
          take: 8,
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        },
        quotes: {
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { contact: true }
        },
        attendances: {
          orderBy: { performedAt: 'desc' },
          take: 8,
          include: { contact: true }
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 12
        },
        _count: {
          select: {
            contacts: true,
            leads: true,
            quotes: true,
            appointments: true,
            attendances: true,
            incomeRecords: true,
            expenses: true,
            conversations: true,
            messages: true,
            evidenceFiles: true,
            messageTemplates: true
          }
        }
      }
    });

    if (!professional) throw new NotFoundException('Profesional no encontrado.');

    const [lastInbound, lastOutbound, failedOutboundCount] = await Promise.all([
      this.prisma.whatsAppMessage.findFirst({
        where: { professionalId, direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.whatsAppMessage.findFirst({
        where: { professionalId, direction: 'OUTBOUND' },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.whatsAppMessage.count({
        where: { professionalId, direction: 'OUTBOUND', outboundStatus: 'FAILED' }
      })
    ]);
    const demoCounts = await this.countDemoData(professionalId);
    const totalCounts = professional._count as any;
    const realCounts = {
      contacts: Math.max(0, totalCounts.contacts - demoCounts.contacts),
      leads: Math.max(0, totalCounts.leads - demoCounts.leads),
      quotes: Math.max(0, totalCounts.quotes - demoCounts.quotes),
      appointments: Math.max(0, totalCounts.appointments - demoCounts.appointments),
      attendances: Math.max(0, totalCounts.attendances - demoCounts.attendances),
      incomeRecords: Math.max(0, totalCounts.incomeRecords - demoCounts.incomeRecords),
      expenses: Math.max(0, totalCounts.expenses - demoCounts.expenses),
      conversations: Math.max(0, totalCounts.conversations - demoCounts.conversations),
      messages: Math.max(0, totalCounts.messages - demoCounts.messages),
      evidenceFiles: Math.max(0, totalCounts.evidenceFiles - demoCounts.evidenceFiles)
    };
    const fluxioPhoneReady = Boolean(
      this.config.get<string>('KAPSO_PLATFORM_PHONE_DISPLAY') ||
      professional.whatsappConnections[0]?.displayPhone ||
      this.config.get<string>('KAPSO_SANDBOX_PHONE_NUMBER_ID')
    );
    const activationChecklist = this.buildActivationChecklist({
      accountActive: professional.user.accountStatus === 'ACTIVE',
      profileComplete: Boolean(professional.displayName && professional.profession && professional.phone),
      commandPhonesReady: this.parsePhones(professional.phone, professional.assistantAllowedPhones).length > 0,
      fluxioPhoneReady,
      firstInboundReady: Boolean(lastInbound || professional.auditLogs.find((row) => row.action === 'KAPSO_WEBHOOK_RECEIVED')),
      outboundReady: Boolean(lastOutbound && lastOutbound.outboundStatus !== 'FAILED'),
      templatesReady: (professional._count as any).messageTemplates >= 4
    });
    const activationSummary = this.activationSummary(activationChecklist);

    return {
      id: professional.id,
      displayName: professional.displayName,
      profession: professional.profession,
      phone: professional.phone,
      assistantAllowedPhones: professional.assistantAllowedPhones,
      email: professional.email,
      adminNotes: professional.adminNotes,
      timezone: professional.timezone,
      currency: professional.currency,
      kapsoCustomerId: professional.kapsoCustomerId,
      createdAt: professional.createdAt,
      updatedAt: professional.updatedAt,
      user: professional.user,
      invitation: professional.user.acceptedInvitations[0]
        ? this.withInvitationDelivery(professional.user.acceptedInvitations[0])
        : null,
      counts: professional._count,
      demoCounts,
      realCounts,
      activationChecklist,
      activationCompleted: activationSummary.completed,
      activationTotal: activationSummary.total,
      activationStatus: activationSummary.status,
      readyForDemo: activationSummary.readyForDemo,
      nextActivationStep: activationSummary.nextStep,
      lastInboundAt: lastInbound?.createdAt || null,
      lastOutboundAt: lastOutbound?.createdAt || null,
      lastOutboundStatus: lastOutbound?.outboundStatus || null,
      failedOutboundCount,
      phoneConflicts: await this.findPhoneConflicts(professional.id),
      whatsappConnections: professional.whatsappConnections.map((connection) => ({
        id: connection.id,
        status: connection.status,
        setupLinkStatus: connection.setupLinkStatus,
        phoneNumberId: connection.phoneNumberId,
        displayPhone: connection.displayPhone,
        connectionType: connection.connectionType,
        lastError: connection.lastError,
        updatedAt: connection.updatedAt,
        createdAt: connection.createdAt
      })),
      contacts: professional.contacts,
      conversations: professional.conversations.map((conversation) => ({
        id: conversation.id,
        contactName: conversation.contactName,
        contactPhone: conversation.contactPhone,
        lastMessageAt: conversation.lastMessageAt,
        lastMessage: conversation.messages[0] || null
      })),
      quotes: professional.quotes,
      attendances: professional.attendances,
      auditLogs: professional.auditLogs.map((row) => {
        return this.formatAuditLog(row);
      })
    };
  }

  async updateAdminNotes(professionalId: string, body: any) {
    const notes = String(body?.adminNotes || '').trim() || null;
    const professional = await this.prisma.professional.findUnique({ where: { id: professionalId } });
    if (!professional) throw new NotFoundException('Profesional no encontrado.');

    const updated = await this.prisma.professional.update({
      where: { id: professionalId },
      data: { adminNotes: notes },
      select: {
        id: true,
        adminNotes: true,
        updatedAt: true
      }
    });

    await this.prisma.auditLog.create({
      data: {
        professionalId,
        action: 'PLATFORM_ADMIN_UPDATED_PROFESSIONAL_NOTES',
        entity: 'Professional',
        entityId: professionalId,
        metadata: {
          hadPreviousNotes: Boolean(professional.adminNotes),
          hasNotes: Boolean(notes)
        }
      }
    });

    return updated;
  }

  async prepareDemoData(professionalId: string) {
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      include: { user: true, whatsappConnections: { orderBy: { updatedAt: 'desc' }, take: 1 } }
    });
    if (!professional) throw new NotFoundException('Profesional no encontrado.');

    const now = new Date();
    const appointmentStart = new Date(now);
    appointmentStart.setDate(appointmentStart.getDate() + 1);
    appointmentStart.setHours(10, 0, 0, 0);
    const appointmentEnd = new Date(appointmentStart);
    appointmentEnd.setHours(11, 0, 0, 0);

    const demoPhone = '+56922222222';
    const demoPhoneNormalized = '56922222222';
    const demoSource = 'Fluxio Demo';
    const demoClientName = 'Ana Perez';
    const demoService = 'Curacion simple a domicilio';
    const demoAmount = 25000;
    const demoExpense = 8500;
    const platformPhone =
      this.config.get<string>('KAPSO_PLATFORM_PHONE_DISPLAY') ||
      professional.whatsappConnections[0]?.displayPhone ||
      this.config.get<string>('KAPSO_SANDBOX_PHONE_NUMBER_ID') ||
      '+56920403095';

    const contact =
      (await this.prisma.contact.findFirst({
        where: {
          professionalId,
          OR: [{ phone: demoPhone }, { phone: demoPhoneNormalized }],
          source: demoSource
        }
      })) ||
      (await this.prisma.contact.findFirst({
        where: {
          professionalId,
          phone: demoPhone
        }
      }));

    const savedContact = contact
      ? await this.prisma.contact.update({
          where: { id: contact.id },
          data: {
            fullName: demoClientName,
            phone: demoPhone,
            source: demoSource,
            commune: 'Providencia',
            address: 'Direccion demo',
            notes: 'Cliente demo creado desde Admin para mostrar el flujo comercial.'
          }
        })
      : await this.prisma.contact.create({
          data: {
            professionalId,
            fullName: demoClientName,
            phone: demoPhone,
            source: demoSource,
            commune: 'Providencia',
            address: 'Direccion demo',
            notes: 'Cliente demo creado desde Admin para mostrar el flujo comercial.'
          }
        });

    const lead =
      (await this.prisma.lead.findFirst({
        where: { professionalId, contactId: savedContact.id, source: demoSource, title: demoService }
      })) ||
      (await this.prisma.lead.create({
        data: {
          professionalId,
          contactId: savedContact.id,
          title: demoService,
          description: 'Solicitud demo recibida por WhatsApp.',
          source: demoSource,
          status: 'CONTACTED',
          estimatedValue: demoAmount,
          nextActionAt: appointmentStart
        }
      }));

    const savedLead = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        contactId: savedContact.id,
        description: 'Solicitud demo recibida por WhatsApp.',
        source: demoSource,
        status: 'CONTACTED',
        estimatedValue: demoAmount,
        nextActionAt: appointmentStart
      }
    });

    const quoteMessage = `Hola Ana, la cotizacion por ${demoService} es de $${demoAmount.toLocaleString('es-CL')}. Incluye insumos basicos y atencion a domicilio.`;
    const quote =
      (await this.prisma.quote.findFirst({
        where: { professionalId, contactId: savedContact.id, title: demoService, description: { contains: 'demo', mode: 'insensitive' } }
      })) ||
      (await this.prisma.quote.create({
        data: {
          professionalId,
          contactId: savedContact.id,
          leadId: savedLead.id,
          title: demoService,
          description: 'Cotizacion demo creada desde Admin.',
          amount: demoAmount,
          status: 'ACCEPTED',
          message: quoteMessage,
          sentAt: now,
          acceptedAt: now
        }
      }));

    const savedQuote = await this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        contactId: savedContact.id,
        leadId: savedLead.id,
        description: 'Cotizacion demo creada desde Admin.',
        amount: demoAmount,
        status: 'ACCEPTED',
        message: quoteMessage,
        sentAt: quote.sentAt || now,
        acceptedAt: quote.acceptedAt || now
      }
    });

    const appointment =
      (await this.prisma.appointment.findFirst({
        where: { professionalId, contactId: savedContact.id, title: `Demo - ${demoService}` }
      })) ||
      (await this.prisma.appointment.create({
        data: {
          professionalId,
          contactId: savedContact.id,
          title: `Demo - ${demoService}`,
          description: 'Agenda demo creada desde Admin.',
          startsAt: appointmentStart,
          endsAt: appointmentEnd,
          status: 'SCHEDULED',
          location: 'Providencia'
        }
      }));

    const savedAppointment = await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        contactId: savedContact.id,
        description: 'Agenda demo creada desde Admin.',
        startsAt: appointmentStart,
        endsAt: appointmentEnd,
        status: 'SCHEDULED',
        location: 'Providencia'
      }
    });

    const attendance =
      (await this.prisma.attendance.findFirst({
        where: { professionalId, contactId: savedContact.id, quoteId: savedQuote.id }
      })) ||
      (await this.prisma.attendance.findFirst({
        where: { professionalId, contactId: savedContact.id, title: `Demo - ${demoService}` }
      })) ||
      (await this.prisma.attendance.create({
        data: {
          professionalId,
          contactId: savedContact.id,
          quoteId: savedQuote.id,
          title: `Demo - ${demoService}`,
          description: 'Atencion demo convertida desde cotizacion aceptada.',
          amount: demoAmount,
          status: 'DONE',
          performedAt: now
        }
      }));

    const savedAttendance = await this.prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        contactId: savedContact.id,
        quoteId: savedQuote.id,
        description: 'Atencion demo convertida desde cotizacion aceptada.',
        amount: demoAmount,
        status: 'DONE',
        performedAt: attendance.performedAt || now
      }
    });

    const income =
      (await this.prisma.incomeRecord.findFirst({
        where: { professionalId, attendanceId: savedAttendance.id }
      })) ||
      (await this.prisma.incomeRecord.create({
        data: {
          professionalId,
          contactId: savedContact.id,
          attendanceId: savedAttendance.id,
          description: `Ingreso demo - ${demoService}`,
          amount: demoAmount,
          paymentStatus: 'PAID',
          paymentMethod: 'TRANSFER',
          paidAt: now
        }
      }));

    const savedIncome = await this.prisma.incomeRecord.update({
      where: { id: income.id },
      data: {
        contactId: savedContact.id,
        attendanceId: savedAttendance.id,
        description: `Ingreso demo - ${demoService}`,
        amount: demoAmount,
        paymentStatus: 'PAID',
        paymentMethod: 'TRANSFER',
        paidAt: income.paidAt || now
      }
    });

    const expense =
      (await this.prisma.expense.findFirst({
        where: {
          professionalId,
          contactId: savedContact.id,
          attendanceId: savedAttendance.id,
          description: 'Insumos demo farmacia'
        }
      })) ||
      (await this.prisma.expense.create({
        data: {
          professionalId,
          contactId: savedContact.id,
          leadId: savedLead.id,
          attendanceId: savedAttendance.id,
          description: 'Insumos demo farmacia',
          amount: demoExpense,
          category: 'Insumos',
          spentAt: now
        }
      }));

    const savedExpense = await this.prisma.expense.update({
      where: { id: expense.id },
      data: {
        contactId: savedContact.id,
        leadId: savedLead.id,
        attendanceId: savedAttendance.id,
        amount: demoExpense,
        category: 'Insumos',
        spentAt: expense.spentAt || now
      }
    });

    const conversation =
      (await this.prisma.whatsAppConversation.findFirst({
        where: { professionalId, contactPhone: demoPhone }
      })) ||
      (await this.prisma.whatsAppConversation.create({
        data: {
          professionalId,
          contactPhone: demoPhone,
          contactName: demoClientName,
          lastMessageAt: now
        }
      }));

    const savedConversation = await this.prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        contactName: demoClientName,
        lastMessageAt: now
      }
    });

    const demoMessages = [
      {
        kapsoMessageId: `demo-${professionalId}-inbound-need`,
        direction: 'INBOUND' as const,
        fromPhone: demoPhone,
        toPhone: platformPhone,
        text: 'Hola, necesito una curacion simple a domicilio.'
      },
      {
        kapsoMessageId: `demo-${professionalId}-outbound-reply`,
        direction: 'OUTBOUND' as const,
        fromPhone: platformPhone,
        toPhone: demoPhone,
        text: 'Hola Ana, claro. Te puedo enviar una cotizacion.',
        outboundStatus: 'SENT',
        outboundSource: 'admin_demo'
      },
      {
        kapsoMessageId: `demo-${professionalId}-outbound-quote`,
        direction: 'OUTBOUND' as const,
        fromPhone: platformPhone,
        toPhone: demoPhone,
        text: quoteMessage,
        outboundStatus: 'SENT',
        outboundSource: 'admin_demo_quote'
      },
      {
        kapsoMessageId: `demo-${professionalId}-inbound-accepted`,
        direction: 'INBOUND' as const,
        fromPhone: demoPhone,
        toPhone: platformPhone,
        text: 'Acepto, coordinemos para manana.'
      }
    ];

    const savedMessages = [];
    for (const message of demoMessages) {
      const existing = await this.prisma.whatsAppMessage.findFirst({
        where: { professionalId, kapsoMessageId: message.kapsoMessageId }
      });
      const data = {
        professionalId,
        conversationId: savedConversation.id,
        kapsoMessageId: message.kapsoMessageId,
        direction: message.direction,
        fromPhone: message.fromPhone,
        toPhone: message.toPhone,
        type: 'text',
        text: message.text,
        outboundStatus: (message as any).outboundStatus || null,
        outboundSource: (message as any).outboundSource || null,
        sentAt: message.direction === 'OUTBOUND' ? now : null,
        payload: {
          source: demoSource,
          preparedBy: 'platform_admin'
        }
      };
      savedMessages.push(
        existing
          ? await this.prisma.whatsAppMessage.update({ where: { id: existing.id }, data })
          : await this.prisma.whatsAppMessage.create({ data })
      );
    }

    await this.prisma.auditLog.create({
      data: {
        professionalId,
        action: 'PLATFORM_ADMIN_PREPARED_DEMO_DATA',
        entity: 'Professional',
        entityId: professionalId,
        metadata: {
          contactId: savedContact.id,
          leadId: savedLead.id,
          quoteId: savedQuote.id,
          appointmentId: savedAppointment.id,
          attendanceId: savedAttendance.id,
          incomeRecordId: savedIncome.id,
          expenseId: savedExpense.id,
          conversationId: savedConversation.id,
          messageIds: savedMessages.map((message) => message.id)
        }
      }
    });

    return {
      ok: true,
      professionalId,
      summary: {
        contact: demoClientName,
        phone: demoPhone,
        lead: savedLead.title,
        quoteStatus: savedQuote.status,
        appointmentAt: savedAppointment.startsAt,
        attendance: savedAttendance.title,
        income: savedIncome.amount,
        expense: savedExpense.amount,
        messages: savedMessages.length
      },
      ids: {
        contactId: savedContact.id,
        leadId: savedLead.id,
        quoteId: savedQuote.id,
        appointmentId: savedAppointment.id,
        attendanceId: savedAttendance.id,
        incomeRecordId: savedIncome.id,
        expenseId: savedExpense.id,
        conversationId: savedConversation.id
      }
    };
  }

  async resetDemoData(professionalId: string) {
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      select: { id: true }
    });
    if (!professional) throw new NotFoundException('Profesional no encontrado.');

    const deleted = await this.deleteDemoData(professionalId);
    await this.prisma.auditLog.create({
      data: {
        professionalId,
        action: 'PLATFORM_ADMIN_RESET_DEMO_DATA',
        entity: 'Professional',
        entityId: professionalId,
        metadata: { deleted }
      }
    });

    const prepared = await this.prepareDemoData(professionalId);
    return {
      ok: true,
      professionalId,
      deleted,
      prepared: prepared.summary
    };
  }

  async demoHealth(professionalId: string) {
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      include: {
        user: true,
        whatsappConnections: {
          orderBy: { updatedAt: 'desc' },
          take: 3
        },
        _count: {
          select: {
            contacts: true,
            leads: true,
            quotes: true,
            appointments: true,
            attendances: true,
            messages: true,
            messageTemplates: true
          }
        }
      }
    });
    if (!professional) throw new NotFoundException('Profesional no encontrado.');

    const demoPhone = '+56922222222';
    const demoSource = 'Fluxio Demo';
    const demoService = 'Curacion simple a domicilio';
    const [demoContact, demoQuote, demoAppointment, demoAttendance, demoConversation, latestInbound, latestOutbound, failedOutboundCount, activeTemplates] = await Promise.all([
      this.prisma.contact.findFirst({ where: { professionalId, source: demoSource, phone: demoPhone } }),
      this.prisma.quote.findFirst({ where: { professionalId, title: demoService, description: { contains: 'demo', mode: 'insensitive' } } }),
      this.prisma.appointment.findFirst({ where: { professionalId, title: `Demo - ${demoService}` } }),
      this.prisma.attendance.findFirst({ where: { professionalId, title: `Demo - ${demoService}` } }),
      this.prisma.whatsAppConversation.findFirst({
        where: { professionalId, contactPhone: demoPhone },
        include: { messages: { select: { id: true }, take: 5 } }
      }),
      this.prisma.whatsAppMessage.findFirst({ where: { professionalId, direction: 'INBOUND' }, orderBy: { createdAt: 'desc' } }),
      this.prisma.whatsAppMessage.findFirst({ where: { professionalId, direction: 'OUTBOUND' }, orderBy: { createdAt: 'desc' } }),
      this.prisma.whatsAppMessage.count({ where: { professionalId, direction: 'OUTBOUND', outboundStatus: 'FAILED' } }),
      this.prisma.messageTemplate.count({ where: { professionalId, active: true } })
    ]);

    const checks = [
      {
        key: 'account_active',
        title: 'Cuenta activa',
        ok: professional.user.accountStatus === 'ACTIVE',
        detail: professional.user.accountStatus
      },
      {
        key: 'profile_complete',
        title: 'Perfil completo',
        ok: Boolean(professional.displayName && professional.profession && professional.phone),
        detail: `${professional.displayName || '-'} / ${professional.profession || '-'} / ${professional.phone || '-'}`
      },
      {
        key: 'command_phone',
        title: 'Telefono autorizado',
        ok: this.parsePhones(professional.phone, professional.assistantAllowedPhones).length > 0,
        detail: this.parsePhones(professional.phone, professional.assistantAllowedPhones).join(', ') || '-'
      },
      {
        key: 'fluxio_phone',
        title: 'Numero Fluxio/Kapso',
        ok: Boolean(this.config.get<string>('KAPSO_PLATFORM_PHONE_DISPLAY') || professional.whatsappConnections[0]?.displayPhone || this.config.get<string>('KAPSO_SANDBOX_PHONE_NUMBER_ID')),
        detail: this.config.get<string>('KAPSO_PLATFORM_PHONE_DISPLAY') || professional.whatsappConnections[0]?.displayPhone || this.config.get<string>('KAPSO_SANDBOX_PHONE_NUMBER_ID') || '-'
      },
      {
        key: 'templates',
        title: 'Plantillas activas',
        ok: activeTemplates >= 4,
        detail: `${activeTemplates} activas`
      },
      {
        key: 'demo_data',
        title: 'Datos demo base',
        ok: Boolean(demoContact && demoQuote && demoAppointment && demoAttendance && demoConversation),
        detail: [
          demoContact ? 'cliente' : null,
          demoQuote ? 'cotizacion' : null,
          demoAppointment ? 'agenda' : null,
          demoAttendance ? 'atencion' : null,
          demoConversation ? 'chat' : null
        ].filter(Boolean).join(', ') || 'faltan datos demo'
      },
      {
        key: 'inbound',
        title: 'Webhook inbound',
        ok: Boolean(latestInbound),
        detail: latestInbound?.createdAt || null
      },
      {
        key: 'outbound',
        title: 'Outbound registrado',
        ok: Boolean(latestOutbound && latestOutbound.outboundStatus !== 'FAILED'),
        detail: latestOutbound?.outboundStatus || 'sin mensajes'
      },
      {
        key: 'outbound_errors',
        title: 'Sin errores outbound',
        ok: failedOutboundCount === 0,
        detail: `${failedOutboundCount} fallidos`
      }
    ];

    const passed = checks.filter((check) => check.ok).length;
    return {
      professionalId,
      ready: passed === checks.length,
      passed,
      total: checks.length,
      status: passed === checks.length ? 'READY' : 'NEEDS_ACTION',
      checks
    };
  }

  async realPilotHealth(professionalId: string) {
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      include: {
        user: true,
        whatsappConnections: {
          orderBy: { updatedAt: 'desc' },
          take: 3
        }
      }
    });
    if (!professional) throw new NotFoundException('Profesional no encontrado.');

    const realWhere = this.realWhere();
    const [contacts, leads, quotes, attendances, incomeRecords, conversations, latestOutbound, failedOutboundCount, demoCounts] = await Promise.all([
      this.prisma.contact.count({ where: { professionalId, ...realWhere.contact } }),
      this.prisma.lead.count({ where: { professionalId, ...realWhere.lead } }),
      this.prisma.quote.count({ where: { professionalId, ...realWhere.quote } }),
      this.prisma.attendance.count({ where: { professionalId, ...realWhere.attendance } }),
      this.prisma.incomeRecord.count({ where: { professionalId, ...realWhere.incomeRecord } }),
      this.prisma.whatsAppConversation.count({ where: { professionalId, ...realWhere.conversation } }),
      this.prisma.whatsAppMessage.findFirst({ where: { professionalId, direction: 'OUTBOUND' }, orderBy: { createdAt: 'desc' } }),
      this.prisma.whatsAppMessage.count({ where: { professionalId, direction: 'OUTBOUND', outboundStatus: 'FAILED' } }),
      this.countDemoData(professionalId)
    ]);

    const checks = [
      {
        key: 'account_active',
        title: 'Cuenta activa',
        ok: professional.user.accountStatus === 'ACTIVE',
        detail: professional.user.accountStatus,
        action: 'Aprobar la cuenta si sigue pendiente.'
      },
      {
        key: 'command_phone',
        title: 'Telefono autorizado',
        ok: this.parsePhones(professional.phone, professional.assistantAllowedPhones).length > 0,
        detail: this.parsePhones(professional.phone, professional.assistantAllowedPhones).join(', ') || '-',
        action: 'Configurar telefono principal o telefonos autorizados.'
      },
      {
        key: 'real_contact',
        title: 'Cliente real',
        ok: contacts > 0,
        detail: `${contacts} clientes reales`,
        action: 'Pedir al profesional crear su primer cliente real.'
      },
      {
        key: 'real_opportunity',
        title: 'Lead o cotizacion real',
        ok: leads > 0 || quotes > 0,
        detail: `${leads} leads / ${quotes} cotizaciones reales`,
        action: 'Crear una cotizacion real o capturar un lead real.'
      },
      {
        key: 'real_service',
        title: 'Atencion o ingreso real',
        ok: attendances > 0 || incomeRecords > 0,
        detail: `${attendances} atenciones / ${incomeRecords} ingresos reales`,
        action: 'Registrar una atencion real o un cobro/pendiente.'
      },
      {
        key: 'real_whatsapp',
        title: 'Conversacion WhatsApp real',
        ok: conversations > 0,
        detail: `${conversations} conversaciones reales`,
        action: 'Probar un mensaje real desde o hacia un cliente no demo.'
      },
      {
        key: 'outbound_errors',
        title: 'Sin outbound fallido',
        ok: failedOutboundCount === 0,
        detail: `${failedOutboundCount} fallidos`,
        action: 'Revisar mensajes salientes fallidos antes del piloto.'
      },
      {
        key: 'demo_separated',
        title: 'Demo separado de real',
        ok: demoCounts.contacts >= 0 && contacts >= 0,
        detail: `${demoCounts.contacts} clientes demo / ${contacts} reales`,
        action: 'Usar filtros Demo/Reales si hay dudas.'
      }
    ];

    const passed = checks.filter((check) => check.ok).length;
    return {
      professionalId,
      ready: passed === checks.length,
      passed,
      total: checks.length,
      status: passed === checks.length ? 'READY_FOR_REAL_PILOT' : 'NEEDS_REAL_ACTIVITY',
      counts: {
        contacts,
        leads,
        quotes,
        attendances,
        incomeRecords,
        conversations,
        failedOutboundCount,
        latestOutboundStatus: latestOutbound?.outboundStatus || null
      },
      checks
    };
  }

  async updateProfessionalPhones(professionalId: string, data: any) {
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      include: { user: true }
    });
    if (!professional) throw new NotFoundException('Profesional no encontrado.');

    const phone = typeof data?.phone === 'string' ? data.phone.trim() : professional.phone;
    const assistantAllowedPhones =
      typeof data?.assistantAllowedPhones === 'string'
        ? data.assistantAllowedPhones.trim()
        : professional.assistantAllowedPhones;

    const conflicts = await this.findPhoneConflicts(professionalId, phone, assistantAllowedPhones);
    const hasActiveOrApprovedConflict = conflicts.some((conflict) =>
      conflict.professionals.some((item: any) => item.accountStatus === 'ACTIVE' || professional.user.accountStatus === 'ACTIVE')
    );

    if (hasActiveOrApprovedConflict) {
      throw new BadRequestException({
        message: 'Ese telefono ya esta asignado a otro profesional activo o a una cuenta activa.',
        conflicts
      });
    }

    const updated = await this.prisma.professional.update({
      where: { id: professionalId },
      data: { phone, assistantAllowedPhones }
    });

    await this.prisma.auditLog.create({
      data: {
        professionalId,
        action: 'PLATFORM_ADMIN_UPDATED_COMMAND_PHONES',
        entity: 'Professional',
        entityId: professionalId,
        metadata: {
          phone,
          assistantAllowedPhones,
          conflictsAfterSave: await this.findPhoneConflicts(professionalId, phone, assistantAllowedPhones)
        }
      }
    });

    return {
      id: updated.id,
      phone: updated.phone,
      assistantAllowedPhones: updated.assistantAllowedPhones,
      phoneConflicts: await this.findPhoneConflicts(updated.id)
    };
  }

  async validateRouting() {
    const users = await this.prisma.user.findMany({
      include: { professional: true },
      orderBy: { createdAt: 'desc' }
    });

    const byPhone = new Map<string, any[]>();
    for (const user of users) {
      if (!user.professional) continue;
      const phones = [
        user.professional.phone,
        ...String(user.professional.assistantAllowedPhones || '').split(/[\s,;]+/)
      ]
        .map((phone) => this.normalizePhone(phone))
        .filter(Boolean);

      for (const phone of new Set(phones)) {
        const rows = byPhone.get(phone) || [];
        rows.push({
          userId: user.id,
          email: user.email,
          accountStatus: user.accountStatus,
          professionalId: user.professional.id,
          displayName: user.professional.displayName
        });
        byPhone.set(phone, rows);
      }
    }

    const conflicts = [...byPhone.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([phone, rows]) => ({ phone, professionals: rows }));

    const missingCommandPhones = users
      .filter((user) => user.professional)
      .filter((user) => !this.normalizePhone(user.professional?.phone) && !this.normalizePhone(user.professional?.assistantAllowedPhones))
      .map((user) => ({
        userId: user.id,
        email: user.email,
        accountStatus: user.accountStatus,
        professionalId: user.professional!.id,
        displayName: user.professional!.displayName
      }));

    return {
      ok: conflicts.length === 0,
      conflicts,
      missingCommandPhones,
      checkedAt: new Date()
    };
  }

  async outboundMessages(status = '', take = 50) {
    const safeTake = Math.min(Math.max(Number(take) || 50, 1), 100);
    const normalizedStatus = status.trim().toUpperCase();
    const rows = await this.prisma.whatsAppMessage.findMany({
      where: {
        direction: 'OUTBOUND',
        ...(normalizedStatus ? { outboundStatus: normalizedStatus } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: safeTake,
      include: {
        professional: {
          include: { user: true }
        },
        conversation: true,
        retryOfMessage: true
      }
    });

    return rows.map((row) => this.mapOutboundMessage(row));
  }

  async whatsappHealth() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const stuckBefore = new Date(now.getTime() - 5 * 60 * 1000);
    const successfulStatuses = ['SENT', 'DELIVERED', 'READ', 'SIMULATED'];
    const [
      statusGroups,
      stuckMessages,
      lastWebhook,
      lastInbound,
      lastOutbound,
      connectionGroups,
      failedConnections
    ] = await Promise.all([
      this.prisma.whatsAppMessage.groupBy({
        by: ['outboundStatus'],
        where: { direction: 'OUTBOUND', createdAt: { gte: last24Hours } },
        _count: { _all: true }
      }),
      this.prisma.whatsAppMessage.findMany({
        where: {
          direction: 'OUTBOUND',
          outboundStatus: 'SENDING',
          createdAt: { lt: stuckBefore }
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
        include: {
          professional: { include: { user: true } },
          conversation: true,
          retryOfMessage: true
        }
      }),
      this.prisma.auditLog.findFirst({
        where: { action: 'KAPSO_WEBHOOK_RECEIVED' },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.whatsAppMessage.findFirst({
        where: { direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.whatsAppMessage.findFirst({
        where: { direction: 'OUTBOUND' },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.whatsAppConnection.groupBy({
        by: ['status'],
        _count: { _all: true }
      }),
      this.prisma.whatsAppConnection.findMany({
        where: { OR: [{ status: { equals: 'failed', mode: 'insensitive' } }, { lastError: { not: null } }] },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: { professional: { include: { user: true } } }
      })
    ]);

    const statusCounts = Object.fromEntries(
      statusGroups.map((group) => [(group.outboundStatus || 'UNKNOWN').toUpperCase(), group._count._all])
    );
    const connectionCounts = Object.fromEntries(
      connectionGroups.map((group) => [(group.status || 'UNKNOWN').toUpperCase(), group._count._all])
    );
    const total = statusGroups.reduce((sum, group) => sum + group._count._all, 0);
    const successful = successfulStatuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0);
    const failed = statusCounts.FAILED || 0;
    const terminal = successful + failed;
    const issues: Array<{ severity: 'warning' | 'critical'; title: string; detail: string }> = [];
    const kapso = this.kapsoConfig.get();

    if (!kapso.isApiConfigured) {
      issues.push({
        severity: kapso.isSandbox ? 'warning' : 'critical',
        title: 'API de Kapso no configurada',
        detail: 'Los mensajes salientes quedan simulados hasta configurar una API key valida.'
      });
    }
    if (stuckMessages.length) {
      issues.push({
        severity: 'critical',
        title: `${stuckMessages.length} mensaje${stuckMessages.length === 1 ? '' : 's'} atascado${stuckMessages.length === 1 ? '' : 's'}`,
        detail: 'Llevan mas de cinco minutos en estado SENDING y ya pueden revisarse o reintentarse.'
      });
    }
    if (failed > 0) {
      issues.push({
        severity: failed >= 5 ? 'critical' : 'warning',
        title: `${failed} envio${failed === 1 ? '' : 's'} fallido${failed === 1 ? '' : 's'} en 24 horas`,
        detail: 'Revisa el error y usa el reintento controlado solo cuando la causa este corregida.'
      });
    }
    if (failedConnections.length) {
      issues.push({
        severity: 'warning',
        title: `${failedConnections.length} conexion${failedConnections.length === 1 ? '' : 'es'} requiere${failedConnections.length === 1 ? '' : 'n'} revision`,
        detail: 'Hay conexiones con estado fallido o con un ultimo error registrado.'
      });
    }

    const critical = issues.some((issue) => issue.severity === 'critical');
    return {
      status: critical ? 'CRITICAL' : issues.length ? 'WARNING' : 'HEALTHY',
      generatedAt: now,
      configuration: {
        mode: kapso.mode,
        apiConfigured: kapso.isApiConfigured,
        webhookConfigured: kapso.isWebhookConfigured
      },
      activity: {
        lastWebhookAt: lastWebhook?.createdAt || null,
        lastInboundAt: lastInbound?.createdAt || null,
        lastOutboundAt: lastOutbound?.createdAt || null
      },
      last24Hours: {
        total,
        sent: statusCounts.SENT || 0,
        delivered: statusCounts.DELIVERED || 0,
        read: statusCounts.READ || 0,
        simulated: statusCounts.SIMULATED || 0,
        failed,
        sending: statusCounts.SENDING || 0,
        stuck: stuckMessages.length,
        successRate: terminal ? Math.round((successful / terminal) * 100) : 100
      },
      connections: {
        total: connectionGroups.reduce((sum, group) => sum + group._count._all, 0),
        connected: connectionCounts.CONNECTED || 0,
        failed: connectionCounts.FAILED || 0,
        pending: connectionCounts.PENDING || 0,
        withErrors: failedConnections.map((connection) => ({
          id: connection.id,
          professionalId: connection.professionalId,
          professionalName: connection.professional.displayName,
          professionalEmail: connection.professional.user.email,
          status: connection.status,
          lastError: connection.lastError,
          updatedAt: connection.updatedAt
        }))
      },
      issues,
      stuckMessages: stuckMessages.map((row) => this.mapOutboundMessage(row))
    };
  }

  async retryOutboundMessage(id: string) {
    const original = await this.prisma.whatsAppMessage.findUnique({
      where: { id },
      include: {
        professional: { include: { user: true } },
        conversation: true
      }
    });
    if (!original || original.direction !== 'OUTBOUND') {
      throw new NotFoundException('Mensaje saliente no encontrado.');
    }

    const retryRoot = original.retryOfMessageId
      ? await this.prisma.whatsAppMessage.findUnique({ where: { id: original.retryOfMessageId } })
      : original;
    if (!retryRoot) {
      throw new BadRequestException('No se encontro el mensaje original del reintento.');
    }
    const eligibility = this.outboundRetryEligibility(original, retryRoot);
    if (!eligibility.retryable) {
      throw new BadRequestException(eligibility.reason);
    }
    if (!original.toPhone) {
      throw new BadRequestException('El mensaje no tiene un telefono de destino.');
    }
    const originalPayload = (original.payload || {}) as Record<string, any>;
    const originalDocument = originalPayload.document || {};
    if (original.type === 'text' && !original.text) {
      throw new BadRequestException('El mensaje original no conserva texto para reenviar.');
    }
    if (original.type === 'document' && (!originalDocument.link || !originalDocument.fileName)) {
      throw new BadRequestException('El documento original no conserva un enlace reutilizable.');
    }

    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { professionalId: original.professionalId, phoneNumberId: { not: null } },
      orderBy: { updatedAt: 'desc' }
    });
    if (!connection?.phoneNumberId || connection.status.toLowerCase() !== 'connected') {
      throw new BadRequestException('El profesional no tiene una conexion WhatsApp activa.');
    }

    const now = new Date();
    const reserved = await this.prisma.whatsAppMessage.updateMany({
      where: {
        id: retryRoot.id,
        retryCount: { lt: 3 },
        OR: [
          { lastRetryAt: null },
          { lastRetryAt: { lte: new Date(now.getTime() - 30 * 1000) } }
        ]
      },
      data: {
        retryCount: { increment: 1 },
        lastRetryAt: now
      }
    });
    if (!reserved.count) {
      throw new BadRequestException('El mensaje alcanzo el limite de reintentos o aun esta en espera.');
    }

    const retryAttempt = retryRoot.retryCount + 1;
    await this.prisma.auditLog.create({
      data: {
        professionalId: original.professionalId,
        action: 'WHATSAPP_OUTBOUND_RETRY_REQUESTED',
        entity: 'WhatsAppMessage',
        entityId: retryRoot.id,
        metadata: { retryAttempt, previousStatus: original.outboundStatus, toPhone: original.toPhone }
      }
    });

    try {
      const common = {
        professionalId: original.professionalId,
        phoneNumberId: connection.phoneNumberId,
        to: original.toPhone,
        conversationId: original.conversationId,
        fromPhone: connection.displayPhone || original.fromPhone,
        source: `retry:${original.outboundSource || 'admin'}`,
        retryOfMessageId: retryRoot.id,
        metadata: { retryAttempt, originalMessageId: retryRoot.id }
      };
      let result;
      if (original.type === 'text' && original.text) {
        result = await this.kapsoService.sendTrackedTextMessage({ ...common, body: original.text });
      } else if (original.type === 'document') {
        result = await this.kapsoService.sendTrackedDocumentMessage({
          ...common,
          link: originalDocument.link,
          fileName: originalDocument.fileName,
          caption: original.text || undefined
        });
      } else {
        throw new BadRequestException(`El tipo ${original.type} no admite reintento automatico.`);
      }

      await this.prisma.auditLog.create({
        data: {
          professionalId: original.professionalId,
          action: 'WHATSAPP_OUTBOUND_RETRY_SUCCEEDED',
          entity: 'WhatsAppMessage',
          entityId: result.messageId,
          metadata: { retryAttempt, originalMessageId: retryRoot.id, simulated: result.simulated }
        }
      });
      return {
        ok: true,
        retryAttempt,
        originalMessageId: retryRoot.id,
        message: this.mapOutboundMessage({
          ...result.message,
          professional: original.professional,
          conversation: original.conversation,
          retryOfMessage: { ...retryRoot, retryCount: retryAttempt, lastRetryAt: now }
        })
      };
    } catch (error: any) {
      const message = error?.message || 'No se pudo reintentar el mensaje.';
      await this.prisma.auditLog.create({
        data: {
          professionalId: original.professionalId,
          action: 'WHATSAPP_OUTBOUND_RETRY_FAILED',
          entity: 'WhatsAppMessage',
          entityId: retryRoot.id,
          metadata: { retryAttempt, originalMessageId: retryRoot.id, error: message }
        }
      });
      if (error instanceof BadRequestException) throw error;
      throw new BadGatewayException(message);
    }
  }

  async previewPhoneReassignment(phone: string) {
    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 8) {
      throw new BadRequestException('Ingresa un telefono valido para buscar.');
    }

    const matches = await this.findReassignmentMatches(normalizedPhone);
    const professionalIds = new Set<string>();
    [
      ...matches.contacts,
      ...matches.conversations,
      ...matches.messages,
      ...matches.leads,
      ...matches.quotes,
      ...matches.appointments,
      ...matches.attendances,
      ...matches.incomeRecords,
      ...matches.expenses,
      ...matches.evidenceFiles
    ].forEach((row: any) => row.professionalId && professionalIds.add(row.professionalId));

    const professionals = professionalIds.size
      ? await this.prisma.professional.findMany({
          where: { id: { in: [...professionalIds] } },
          include: { user: true }
        })
      : [];

    return {
      phone: normalizedPhone,
      totals: this.reassignmentTotals(matches),
      professionals: professionals.map((professional) => ({
        id: professional.id,
        displayName: professional.displayName,
        email: professional.user.email,
        accountStatus: professional.user.accountStatus,
        counts: this.reassignmentTotals(this.filterMatchesByProfessional(matches, professional.id))
      })),
      samples: {
        contacts: matches.contacts.slice(0, 8).map((row) => ({
          id: row.id,
          professionalId: row.professionalId,
          fullName: row.fullName,
          phone: row.phone
        })),
        conversations: matches.conversations.slice(0, 8).map((row) => ({
          id: row.id,
          professionalId: row.professionalId,
          contactName: row.contactName,
          contactPhone: row.contactPhone,
          lastMessageAt: row.lastMessageAt
        })),
        messages: matches.messages.slice(0, 8).map((row) => ({
          id: row.id,
          professionalId: row.professionalId,
          direction: row.direction,
          fromPhone: row.fromPhone,
          toPhone: row.toPhone,
          text: row.text,
          createdAt: row.createdAt
        }))
      }
    };
  }

  async executePhoneReassignment(data: any) {
    const normalizedPhone = this.normalizePhone(data?.phone);
    const targetProfessionalId = String(data?.targetProfessionalId || '');
    const includeWhatsApp = data?.includeWhatsApp !== false;
    const includeContacts = data?.includeContacts !== false;

    if (!normalizedPhone || normalizedPhone.length < 8) {
      throw new BadRequestException('Ingresa un telefono valido para reasignar.');
    }
    if (!targetProfessionalId) {
      throw new BadRequestException('Selecciona un profesional destino.');
    }
    if (!includeWhatsApp && !includeContacts) {
      throw new BadRequestException('Selecciona al menos un grupo de datos para reasignar.');
    }

    const target = await this.prisma.professional.findUnique({
      where: { id: targetProfessionalId },
      include: { user: true }
    });
    if (!target) throw new NotFoundException('Profesional destino no encontrado.');

    const matches = await this.findReassignmentMatches(normalizedPhone);
    const beforeTotals = this.reassignmentTotals(matches);
    const contactIds = matches.contacts.map((row) => row.id);
    const conversationIds = matches.conversations.map((row) => row.id);
    const messageIds = matches.messages.map((row) => row.id);
    const leadIds = matches.leads.map((row) => row.id);
    const quoteIds = matches.quotes.map((row) => row.id);
    const appointmentIds = matches.appointments.map((row) => row.id);
    const attendanceIds = matches.attendances.map((row) => row.id);
    const incomeIds = matches.incomeRecords.map((row) => row.id);
    const expenseIds = matches.expenses.map((row) => row.id);
    const evidenceIds = matches.evidenceFiles.map((row) => row.id);

    const result: any = {};

    await this.prisma.$transaction(async (tx) => {
      if (includeContacts && contactIds.length > 0) {
        result.contacts = await tx.contact.updateMany({
          where: { id: { in: contactIds }, professionalId: { not: targetProfessionalId } },
          data: { professionalId: targetProfessionalId }
        });
        result.leads = await tx.lead.updateMany({
          where: { id: { in: leadIds }, professionalId: { not: targetProfessionalId } },
          data: { professionalId: targetProfessionalId }
        });
        result.quotes = await tx.quote.updateMany({
          where: { id: { in: quoteIds }, professionalId: { not: targetProfessionalId } },
          data: { professionalId: targetProfessionalId }
        });
        result.appointments = await tx.appointment.updateMany({
          where: { id: { in: appointmentIds }, professionalId: { not: targetProfessionalId } },
          data: { professionalId: targetProfessionalId }
        });
        result.attendances = await tx.attendance.updateMany({
          where: { id: { in: attendanceIds }, professionalId: { not: targetProfessionalId } },
          data: { professionalId: targetProfessionalId }
        });
        result.incomeRecords = await tx.incomeRecord.updateMany({
          where: { id: { in: incomeIds }, professionalId: { not: targetProfessionalId } },
          data: { professionalId: targetProfessionalId }
        });
        result.expenses = await tx.expense.updateMany({
          where: { id: { in: expenseIds }, professionalId: { not: targetProfessionalId } },
          data: { professionalId: targetProfessionalId }
        });
      }

      if (includeWhatsApp) {
        result.conversations = await tx.whatsAppConversation.updateMany({
          where: { id: { in: conversationIds }, professionalId: { not: targetProfessionalId } },
          data: { professionalId: targetProfessionalId, connectionId: null }
        });
        result.messages = await tx.whatsAppMessage.updateMany({
          where: { id: { in: messageIds }, professionalId: { not: targetProfessionalId } },
          data: { professionalId: targetProfessionalId }
        });
      }

      if (evidenceIds.length > 0 && (includeContacts || includeWhatsApp)) {
        result.evidenceFiles = await tx.evidenceFile.updateMany({
          where: { id: { in: evidenceIds }, professionalId: { not: targetProfessionalId } },
          data: { professionalId: targetProfessionalId }
        });
      }

      await tx.auditLog.create({
        data: {
          professionalId: targetProfessionalId,
          action: 'PLATFORM_ADMIN_REASSIGNED_DATA_BY_PHONE',
          entity: 'Professional',
          entityId: targetProfessionalId,
          metadata: {
            phone: normalizedPhone,
            targetProfessionalId,
            targetEmail: target.user.email,
            includeWhatsApp,
            includeContacts,
            beforeTotals,
            updated: Object.fromEntries(
              Object.entries(result).map(([key, value]: any) => [key, value?.count || 0])
            )
          }
        }
      });
    });

    return {
      ok: true,
      phone: normalizedPhone,
      targetProfessionalId,
      targetDisplayName: target.displayName,
      beforeTotals,
      updated: Object.fromEntries(
        Object.entries(result).map(([key, value]: any) => [key, value?.count || 0])
      )
    };
  }

  private normalizePhone(phone?: string | null) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits || '';
  }

  private parsePhones(phone?: string | null, assistantAllowedPhones?: string | null) {
    return [
      phone,
      ...String(assistantAllowedPhones || '').split(/[\s,;]+/)
    ]
      .map((item) => this.normalizePhone(item))
      .filter(Boolean);
  }

  private async findPhoneConflicts(professionalId: string, nextPhone?: string | null, nextAssistantAllowedPhones?: string | null) {
    const current = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      include: { user: true }
    });
    if (!current) return [];

    const phones = new Set(this.parsePhones(
      nextPhone === undefined ? current.phone : nextPhone,
      nextAssistantAllowedPhones === undefined ? current.assistantAllowedPhones : nextAssistantAllowedPhones
    ));
    if (phones.size === 0) return [];

    const professionals = await this.prisma.professional.findMany({
      where: {
        id: { not: professionalId },
        OR: [
          { phone: { not: null } },
          { assistantAllowedPhones: { not: null } }
        ]
      },
      include: { user: true },
      take: 500
    });

    const conflicts: any[] = [];
    for (const phone of phones) {
      const matches = professionals
        .filter((professional) => this.parsePhones(professional.phone, professional.assistantAllowedPhones).includes(phone))
        .map((professional) => ({
          userId: professional.userId,
          email: professional.user.email,
          accountStatus: professional.user.accountStatus,
          professionalId: professional.id,
          displayName: professional.displayName
        }));

      if (matches.length > 0) {
        conflicts.push({ phone, professionals: matches });
      }
    }

    return conflicts;
  }

  private async findReassignmentMatches(normalizedPhone: string) {
    const phoneFilter = { contains: normalizedPhone };
    const contacts = await this.prisma.contact.findMany({
      where: { phone: phoneFilter },
      orderBy: { updatedAt: 'desc' },
      take: 500
    });
    const contactIds = contacts.map((row) => row.id);

    const conversations = await this.prisma.whatsAppConversation.findMany({
      where: { contactPhone: phoneFilter },
      orderBy: { updatedAt: 'desc' },
      take: 500
    });
    const conversationIds = conversations.map((row) => row.id);

    const messages = await this.prisma.whatsAppMessage.findMany({
      where: {
        OR: [
          { fromPhone: phoneFilter },
          { toPhone: phoneFilter },
          ...(conversationIds.length ? [{ conversationId: { in: conversationIds } }] : [])
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 1000
    });
    const messageIds = messages.map((row) => row.id);

    const leads = contactIds.length
      ? await this.prisma.lead.findMany({ where: { contactId: { in: contactIds } }, take: 500 })
      : [];
    const leadIds = leads.map((row) => row.id);

    const quotes = contactIds.length || leadIds.length
      ? await this.prisma.quote.findMany({
          where: {
            OR: [
              ...(contactIds.length ? [{ contactId: { in: contactIds } }] : []),
              ...(leadIds.length ? [{ leadId: { in: leadIds } }] : [])
            ]
          },
          take: 500
        })
      : [];

    const appointments = contactIds.length
      ? await this.prisma.appointment.findMany({ where: { contactId: { in: contactIds } }, take: 500 })
      : [];
    const attendances = contactIds.length
      ? await this.prisma.attendance.findMany({ where: { contactId: { in: contactIds } }, take: 500 })
      : [];
    const attendanceIds = attendances.map((row) => row.id);
    const incomeRecords = contactIds.length || attendanceIds.length
      ? await this.prisma.incomeRecord.findMany({
          where: {
            OR: [
              ...(contactIds.length ? [{ contactId: { in: contactIds } }] : []),
              ...(attendanceIds.length ? [{ attendanceId: { in: attendanceIds } }] : [])
            ]
          },
          take: 500
        })
      : [];
    const expenses = contactIds.length || leadIds.length || attendanceIds.length
      ? await this.prisma.expense.findMany({
          where: {
            OR: [
              ...(contactIds.length ? [{ contactId: { in: contactIds } }] : []),
              ...(leadIds.length ? [{ leadId: { in: leadIds } }] : []),
              ...(attendanceIds.length ? [{ attendanceId: { in: attendanceIds } }] : [])
            ]
          },
          take: 500
        })
      : [];

    const evidenceFiles = contactIds.length || leadIds.length || attendanceIds.length || conversationIds.length || messageIds.length
      ? await this.prisma.evidenceFile.findMany({
          where: {
            OR: [
              ...(contactIds.length ? [{ contactId: { in: contactIds } }] : []),
              ...(leadIds.length ? [{ leadId: { in: leadIds } }] : []),
              ...(attendanceIds.length ? [{ attendanceId: { in: attendanceIds } }] : []),
              ...(conversationIds.length ? [{ conversationId: { in: conversationIds } }] : []),
              ...(messageIds.length ? [{ messageId: { in: messageIds } }] : [])
            ]
          },
          take: 500
        })
      : [];

    return {
      contacts,
      conversations,
      messages,
      leads,
      quotes,
      appointments,
      attendances,
      incomeRecords,
      expenses,
      evidenceFiles
    };
  }

  private reassignmentTotals(matches: any) {
    return {
      contacts: matches.contacts.length,
      conversations: matches.conversations.length,
      messages: matches.messages.length,
      leads: matches.leads.length,
      quotes: matches.quotes.length,
      appointments: matches.appointments.length,
      attendances: matches.attendances.length,
      incomeRecords: matches.incomeRecords.length,
      expenses: matches.expenses.length,
      evidenceFiles: matches.evidenceFiles.length
    };
  }

  private filterMatchesByProfessional(matches: any, professionalId: string) {
    return Object.fromEntries(
      Object.entries(matches).map(([key, rows]: any) => [
        key,
        rows.filter((row: any) => row.professionalId === professionalId)
      ])
    );
  }

  private invitationUrl(token: string) {
    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    return `${baseUrl.replace(/\/$/, '')}/?invite=${encodeURIComponent(token)}`;
  }

  private invitationMessage(invitation: any) {
    const appName = this.config.get<string>('APP_NAME') || 'Fluxio';
    const link = this.invitationUrl(invitation.token);
    const name = invitation.displayName || 'Hola';
    const professionLine = invitation.profession ? `\nPerfil sugerido: ${invitation.profession}` : '';

    return [
      `Hola ${name}, te invitamos a activar tu cuenta en ${appName}.`,
      '',
      'Con este link puedes crear tu usuario y solicitar la habilitacion:',
      link,
      professionLine.trim(),
      '',
      'Cuando completes el registro, revisaremos la cuenta y te avisaremos para comenzar con la configuracion inicial.'
    ]
      .filter(Boolean)
      .join('\n');
  }

  private withInvitationDelivery(invitation: any) {
    return {
      ...invitation,
      inviteUrl: this.invitationUrl(invitation.token),
      invitationMessage: this.invitationMessage(invitation)
    };
  }

  private formatAuditLog(row: any) {
    const metadata = row.metadata as any;
    const result = metadata?.result || {};
    const action = String(row.action || '');
    const eventType = metadata?.eventType;
    const category = action.includes('INVITATION')
      ? 'Invitacion'
      : action.includes('ACCOUNT') || action.includes('NOTES')
        ? 'Cuenta'
        : action.includes('DEMO')
          ? 'Demo'
          : action.includes('KAPSO') || action.includes('WHATSAPP') || eventType
            ? 'WhatsApp'
            : 'Sistema';

    return {
      id: row.id,
      action: row.action,
      category,
      entity: row.entity,
      entityId: row.entityId,
      createdAt: row.createdAt,
      eventType,
      summary:
        result?.command ||
        result?.reason ||
        metadata?.nextStatus ||
        metadata?.email ||
        (result?.processed === true ? 'Procesado' : null),
      result: {
        processed: result?.processed,
        reason: result?.reason,
        command: result?.command,
        commandChannel: result?.commandChannel,
        duplicate: result?.duplicate
      }
    };
  }

  private async expireOldInvitations() {
    await this.prisma.professionalInvitation.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' }
    });
  }

  private async deleteDemoData(professionalId: string) {
    const demoSource = 'Fluxio Demo';
    const demoPhone = '+56922222222';
    const demoPhoneNormalized = '56922222222';
    const demoService = 'Curacion simple a domicilio';

    const [contacts, leads, quotes, appointments, attendances, conversations, messages] = await Promise.all([
      this.prisma.contact.findMany({
        where: {
          professionalId,
          OR: [
            { source: demoSource },
            { phone: demoPhone, notes: { contains: 'demo', mode: 'insensitive' } },
            { phone: demoPhoneNormalized, notes: { contains: 'demo', mode: 'insensitive' } }
          ]
        },
        select: { id: true }
      }),
      this.prisma.lead.findMany({
        where: { professionalId, source: demoSource },
        select: { id: true }
      }),
      this.prisma.quote.findMany({
        where: {
          professionalId,
          OR: [
            { title: demoService, description: { contains: 'demo', mode: 'insensitive' } },
            { message: { contains: demoService, mode: 'insensitive' } }
          ]
        },
        select: { id: true }
      }),
      this.prisma.appointment.findMany({
        where: {
          professionalId,
          OR: [
            { title: `Demo - ${demoService}` },
            { description: { contains: 'demo', mode: 'insensitive' } }
          ]
        },
        select: { id: true }
      }),
      this.prisma.attendance.findMany({
        where: {
          professionalId,
          OR: [
            { title: `Demo - ${demoService}` },
            { description: { contains: 'demo', mode: 'insensitive' } }
          ]
        },
        select: { id: true }
      }),
      this.prisma.whatsAppConversation.findMany({
        where: { professionalId, contactPhone: demoPhone, contactName: 'Ana Perez' },
        select: { id: true }
      }),
      this.prisma.whatsAppMessage.findMany({
        where: {
          professionalId,
          OR: [
            { kapsoMessageId: { startsWith: `demo-${professionalId}-` } },
            { outboundSource: { startsWith: 'admin_demo' } }
          ]
        },
        select: { id: true }
      })
    ]);

    const contactIds = contacts.map((row) => row.id);
    const leadIds = leads.map((row) => row.id);
    const quoteIds = quotes.map((row) => row.id);
    const appointmentIds = appointments.map((row) => row.id);
    const attendanceIds = attendances.map((row) => row.id);
    const conversationIds = conversations.map((row) => row.id);
    const messageIds = messages.map((row) => row.id);

    const [incomeRecords, expenses, evidenceFiles] = await Promise.all([
      this.prisma.incomeRecord.findMany({
        where: {
          professionalId,
          OR: [
            { description: { startsWith: 'Ingreso demo' } },
            attendanceIds.length ? { attendanceId: { in: attendanceIds } } : undefined,
            contactIds.length ? { contactId: { in: contactIds } } : undefined
          ].filter(Boolean) as any
        },
        select: { id: true }
      }),
      this.prisma.expense.findMany({
        where: {
          professionalId,
          OR: [
            { description: 'Insumos demo farmacia' },
            attendanceIds.length ? { attendanceId: { in: attendanceIds } } : undefined,
            leadIds.length ? { leadId: { in: leadIds } } : undefined,
            contactIds.length ? { contactId: { in: contactIds } } : undefined
          ].filter(Boolean) as any
        },
        select: { id: true }
      }),
      this.prisma.evidenceFile.findMany({
        where: {
          professionalId,
          OR: [
            { source: demoSource },
            contactIds.length ? { contactId: { in: contactIds } } : undefined,
            leadIds.length ? { leadId: { in: leadIds } } : undefined,
            appointmentIds.length ? { appointmentId: { in: appointmentIds } } : undefined,
            attendanceIds.length ? { attendanceId: { in: attendanceIds } } : undefined,
            conversationIds.length ? { conversationId: { in: conversationIds } } : undefined,
            messageIds.length ? { messageId: { in: messageIds } } : undefined
          ].filter(Boolean) as any
        },
        select: { id: true }
      })
    ]);

    const incomeRecordIds = incomeRecords.map((row) => row.id);
    const expenseIds = expenses.map((row) => row.id);
    const evidenceFileIds = evidenceFiles.map((row) => row.id);
    const deleted: Record<string, number> = {
      evidenceFiles: 0,
      incomeRecords: 0,
      expenses: 0,
      messages: 0,
      conversations: 0,
      attendances: 0,
      appointments: 0,
      quotes: 0,
      leads: 0,
      contacts: 0
    };

    if (evidenceFileIds.length) {
      deleted.evidenceFiles = (await this.prisma.evidenceFile.deleteMany({ where: { id: { in: evidenceFileIds } } })).count;
    }
    if (incomeRecordIds.length) {
      deleted.incomeRecords = (await this.prisma.incomeRecord.deleteMany({ where: { id: { in: incomeRecordIds } } })).count;
    }
    if (expenseIds.length) {
      deleted.expenses = (await this.prisma.expense.deleteMany({ where: { id: { in: expenseIds } } })).count;
    }
    if (messageIds.length) {
      deleted.messages = (await this.prisma.whatsAppMessage.deleteMany({ where: { id: { in: messageIds } } })).count;
    }
    if (conversationIds.length) {
      deleted.conversations = (await this.prisma.whatsAppConversation.deleteMany({ where: { id: { in: conversationIds } } })).count;
    }
    if (attendanceIds.length) {
      deleted.attendances = (await this.prisma.attendance.deleteMany({ where: { id: { in: attendanceIds } } })).count;
    }
    if (appointmentIds.length) {
      deleted.appointments = (await this.prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } })).count;
    }
    if (quoteIds.length) {
      deleted.quotes = (await this.prisma.quote.deleteMany({ where: { id: { in: quoteIds } } })).count;
    }
    if (leadIds.length) {
      deleted.leads = (await this.prisma.lead.deleteMany({ where: { id: { in: leadIds } } })).count;
    }
    if (contactIds.length) {
      deleted.contacts = (await this.prisma.contact.deleteMany({ where: { id: { in: contactIds } } })).count;
    }

    return deleted;
  }

  private async countDemoData(professionalId: string) {
    const demoSource = 'Fluxio Demo';
    const demoPhone = '+56922222222';
    const demoPhoneNormalized = '56922222222';
    const demoService = 'Curacion simple a domicilio';

    const [contacts, leads, quotes, appointments, attendances, incomeRecords, expenses, conversations, messages, evidenceFiles] = await Promise.all([
      this.prisma.contact.count({
        where: {
          professionalId,
          OR: [
            { source: demoSource },
            { phone: demoPhone },
            { phone: demoPhoneNormalized }
          ]
        }
      }),
      this.prisma.lead.count({
        where: {
          professionalId,
          OR: [
            { source: demoSource },
            { title: demoService }
          ]
        }
      }),
      this.prisma.quote.count({
        where: {
          professionalId,
          OR: [
            { title: demoService, description: { contains: 'demo', mode: 'insensitive' } },
            { message: { contains: demoService, mode: 'insensitive' } }
          ]
        }
      }),
      this.prisma.appointment.count({
        where: {
          professionalId,
          OR: [
            { title: `Demo - ${demoService}` },
            { description: { contains: 'demo', mode: 'insensitive' } }
          ]
        }
      }),
      this.prisma.attendance.count({
        where: {
          professionalId,
          OR: [
            { title: `Demo - ${demoService}` },
            { description: { contains: 'demo', mode: 'insensitive' } }
          ]
        }
      }),
      this.prisma.incomeRecord.count({
        where: {
          professionalId,
          OR: [
            { description: { startsWith: 'Ingreso demo' } },
            { contact: { is: { source: demoSource } } },
            { attendance: { is: { title: `Demo - ${demoService}` } } }
          ]
        }
      }),
      this.prisma.expense.count({
        where: {
          professionalId,
          OR: [
            { description: 'Insumos demo farmacia' },
            { contact: { is: { source: demoSource } } },
            { lead: { is: { source: demoSource } } },
            { attendance: { is: { title: `Demo - ${demoService}` } } }
          ]
        }
      }),
      this.prisma.whatsAppConversation.count({
        where: { professionalId, contactPhone: demoPhone }
      }),
      this.prisma.whatsAppMessage.count({
        where: {
          professionalId,
          OR: [
            { kapsoMessageId: { startsWith: `demo-${professionalId}-` } },
            { outboundSource: { startsWith: 'admin_demo' } },
            { fromPhone: demoPhone },
            { toPhone: demoPhone }
          ]
        }
      }),
      this.prisma.evidenceFile.count({
        where: {
          professionalId,
          OR: [
            { source: demoSource },
            { contact: { is: { source: demoSource } } },
            { lead: { is: { source: demoSource } } },
            { attendance: { is: { title: `Demo - ${demoService}` } } },
            { conversation: { is: { contactPhone: demoPhone } } }
          ]
        }
      })
    ]);

    return {
      contacts,
      leads,
      quotes,
      appointments,
      attendances,
      incomeRecords,
      expenses,
      conversations,
      messages,
      evidenceFiles
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

  private mapOutboundMessage(row: any) {
    const retryRoot = row.retryOfMessage || row;
    const eligibility = this.outboundRetryEligibility(row, retryRoot);
    return {
      id: row.id,
      professionalId: row.professionalId,
      professionalName: row.professional.displayName,
      professionalEmail: row.professional.user.email,
      conversationId: row.conversationId,
      contactName: row.conversation?.contactName,
      toPhone: row.toPhone,
      type: row.type,
      text: row.text,
      payload: row.payload,
      outboundStatus: row.outboundStatus,
      outboundSource: row.outboundSource,
      outboundError: row.outboundError,
      kapsoMessageId: row.kapsoMessageId,
      sentAt: row.sentAt,
      deliveredAt: row.deliveredAt,
      readAt: row.readAt,
      failedAt: row.failedAt,
      retryCount: retryRoot.retryCount || 0,
      lastRetryAt: retryRoot.lastRetryAt || null,
      retryOfMessageId: row.retryOfMessageId,
      retryable: eligibility.retryable,
      retryBlockedReason: eligibility.retryable ? null : eligibility.reason,
      operationalStatus: this.isOutboundStuck(row) ? 'STUCK' : row.outboundStatus,
      createdAt: row.createdAt
    };
  }

  private outboundRetryEligibility(message: any, retryRoot: any = message) {
    const status = (message.outboundStatus || '').toUpperCase();
    if (status !== 'FAILED' && !this.isOutboundStuck(message)) {
      return { retryable: false, reason: 'Solo se pueden reintentar mensajes fallidos o atascados.' };
    }
    if (!['text', 'document'].includes(message.type)) {
      return { retryable: false, reason: `El tipo ${message.type} no admite reintento automatico.` };
    }
    if ((retryRoot.retryCount || 0) >= 3) {
      return { retryable: false, reason: 'El mensaje alcanzo el maximo de tres reintentos.' };
    }
    if (retryRoot.lastRetryAt && Date.now() - new Date(retryRoot.lastRetryAt).getTime() < 30 * 1000) {
      return { retryable: false, reason: 'Espera 30 segundos antes de volver a reintentar.' };
    }
    return { retryable: true, reason: null };
  }

  private isOutboundStuck(message: any) {
    return (message.outboundStatus || '').toUpperCase() === 'SENDING'
      && Date.now() - new Date(message.createdAt).getTime() >= 5 * 60 * 1000;
  }

  private buildActivationChecklist(flags: Record<string, boolean>) {
    return [
      {
        key: 'account_active',
        title: 'Cuenta aprobada',
        done: flags.accountActive,
        description: 'El profesional puede iniciar sesion.',
        action: flags.accountActive ? null : 'approve_account',
        actionLabel: flags.accountActive ? null : 'Aprobar cuenta'
      },
      {
        key: 'profile_complete',
        title: 'Perfil completo',
        done: flags.profileComplete,
        description: 'Nombre, profesion y telefono principal.',
        action: flags.profileComplete ? null : 'open_professional_detail',
        actionLabel: flags.profileComplete ? null : 'Revisar perfil'
      },
      {
        key: 'command_phone',
        title: 'WhatsApp autorizado',
        done: flags.commandPhonesReady,
        description: 'El telefono del profesional puede enviar comandos.',
        action: flags.commandPhonesReady ? null : 'edit_command_phones',
        actionLabel: flags.commandPhonesReady ? null : 'Configurar telefonos'
      },
      {
        key: 'fluxio_phone',
        title: 'Numero Fluxio disponible',
        done: flags.fluxioPhoneReady,
        description: 'Existe un numero Fluxio/Kapso para recibir comandos.',
        action: flags.fluxioPhoneReady ? null : 'review_kapso_config',
        actionLabel: flags.fluxioPhoneReady ? null : 'Revisar configuracion'
      },
      {
        key: 'first_inbound',
        title: 'Primer mensaje recibido',
        done: flags.firstInboundReady,
        description: 'El webhook ya recibio al menos un mensaje.',
        action: flags.firstInboundReady ? null : 'send_test_message',
        actionLabel: flags.firstInboundReady ? null : 'Ver instruccion'
      },
      {
        key: 'first_outbound',
        title: 'Primer mensaje saliente',
        done: flags.outboundReady,
        description: 'Fluxio ya registro una respuesta saliente sin fallo.',
        action: flags.outboundReady ? null : 'prepare_demo',
        actionLabel: flags.outboundReady ? null : 'Preparar demo'
      },
      {
        key: 'templates',
        title: 'Plantillas base',
        done: flags.templatesReady,
        description: 'Hay plantillas listas para cotizar y cobrar.',
        action: flags.templatesReady ? null : 'review_templates',
        actionLabel: flags.templatesReady ? null : 'Revisar plantillas'
      }
    ];
  }

  private activationSummary(checklist: any[]) {
    const completed = checklist.filter((item) => item.done).length;
    const total = checklist.length;
    const nextStep = checklist.find((item) => !item.done) || null;
    const readyForDemo = total > 0 && completed === total;

    return {
      completed,
      total,
      nextStep,
      readyForDemo,
      status: readyForDemo ? 'READY_FOR_DEMO' : 'NEEDS_ACTION'
    };
  }
}
