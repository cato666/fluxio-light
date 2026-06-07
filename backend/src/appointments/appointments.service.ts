import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { KapsoService } from '../kapso/kapso.service';
import { MessageTemplatesService } from '../message-templates/message-templates.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateAttendanceFromAppointmentDto } from './dto/create-attendance-from-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private kapso: KapsoService,
    private templates: MessageTemplatesService
  ) {}

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

  async sendReminder(professionalId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, professionalId },
      include: { contact: true }
    });
    if (!appointment) throw new NotFoundException('Appointment not found.');
    if (appointment.status !== 'SCHEDULED') throw new BadRequestException('Only scheduled appointments can receive reminders.');
    if (!appointment.contact?.phone) throw new BadRequestException('Appointment contact phone is required before sending a reminder.');

    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: {
        professionalId,
        phoneNumberId: { not: null },
        status: { in: ['connected', 'CONNECTED'] }
      },
      orderBy: [{ connectionType: 'desc' }, { updatedAt: 'desc' }]
    });
    if (!connection?.phoneNumberId) {
      throw new BadRequestException('No connected WhatsApp connection is available.');
    }

    const conversation = await this.upsertConversation(professionalId, connection.id, appointment.contact.phone, appointment.contact.fullName);
    const template = await this.findTemplate(professionalId, 'appointment_reminder');
    const message = this.templates.render(template?.body || this.defaultReminderTemplate(), {
      cliente: appointment.contact.fullName || appointment.contact.phone,
      servicio: appointment.title,
      fecha: this.formatDateTime(appointment.startsAt),
      lugar: appointment.location || 'por confirmar'
    });

    const sendResult = await this.kapso.sendTrackedTextMessage({
      professionalId,
      conversationId: conversation.id,
      phoneNumberId: connection.phoneNumberId,
      fromPhone: connection.displayPhone || connection.phoneNumberId,
      to: appointment.contact.phone,
      body: message,
      source: 'appointment_reminder',
      metadata: { appointmentId: appointment.id }
    });

    await Promise.all([
      this.prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() }
      }),
      this.prisma.auditLog.create({
        data: {
          professionalId,
          action: 'APPOINTMENT_REMINDER_SENT',
          entity: 'Appointment',
          entityId: appointment.id,
          metadata: {
            messageId: sendResult.messageId,
            simulated: Boolean(sendResult.simulated),
            toPhone: appointment.contact.phone
          }
        }
      })
    ]);

    return {
      ok: true,
      simulated: Boolean(sendResult.simulated),
      message,
      messageId: sendResult.messageId,
      conversationId: conversation.id
    };
  }

  async calendarFile(professionalId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, professionalId },
      include: { contact: true, professional: true }
    });
    if (!appointment) throw new NotFoundException('Appointment not found.');

    const startsAt = appointment.startsAt;
    const endsAt = appointment.endsAt || new Date(startsAt.getTime() + 60 * 60 * 1000);
    const fileName = `${this.slug(appointment.title)}-${this.icsDate(startsAt)}.ics`;
    const description = [
      appointment.description,
      appointment.contact?.fullName ? `Cliente: ${appointment.contact.fullName}` : null,
      appointment.contact?.phone ? `Telefono: ${appointment.contact.phone}` : null
    ].filter(Boolean).join('\\n');

    return {
      fileName,
      content: [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Fluxio Light//Agenda//ES',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:fluxio-appointment-${appointment.id}@fluxio-light`,
        `DTSTAMP:${this.icsDate(new Date())}`,
        `DTSTART:${this.icsDate(startsAt)}`,
        `DTEND:${this.icsDate(endsAt)}`,
        `SUMMARY:${this.icsEscape(appointment.title)}`,
        appointment.location ? `LOCATION:${this.icsEscape(appointment.location)}` : null,
        description ? `DESCRIPTION:${this.icsEscape(description)}` : null,
        'END:VEVENT',
        'END:VCALENDAR'
      ].filter(Boolean).join('\r\n')
    };
  }

  private async findTemplate(professionalId: string, key: string) {
    await this.templates.ensureDefaults(professionalId);
    return this.prisma.messageTemplate.findFirst({
      where: { professionalId, key, active: true }
    });
  }

  private async upsertConversation(professionalId: string, connectionId: string, phone: string, name?: string | null) {
    const existing = await this.prisma.whatsAppConversation.findFirst({
      where: { professionalId, contactPhone: phone }
    });
    if (existing) {
      return this.prisma.whatsAppConversation.update({
        where: { id: existing.id },
        data: {
          connectionId,
          contactName: name || existing.contactName,
          lastMessageAt: new Date()
        }
      });
    }
    return this.prisma.whatsAppConversation.create({
      data: {
        professionalId,
        connectionId,
        contactPhone: phone,
        contactName: name || null,
        lastMessageAt: new Date()
      }
    });
  }

  private defaultReminderTemplate() {
    return 'Hola {{cliente}}, te recuerdo tu atencion {{servicio}} programada para {{fecha}}. Lugar: {{lugar}}.';
  }

  private formatDateTime(value: Date) {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    }).format(value);
  }

  private icsDate(value: Date) {
    return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  private icsEscape(value: string) {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  private slug(value: string) {
    return String(value || 'cita')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 60) || 'cita';
  }
}
