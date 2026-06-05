import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const DEFAULT_TEMPLATES = [
  {
    key: 'quote',
    name: 'Cotizacion',
    body: 'Hola {{cliente}}, te comparto la cotizacion:\n\nServicio: {{servicio}}\nValor: {{monto}}\n\nSi estas de acuerdo, responde "acepto" y coordinamos la atencion.'
  },
  {
    key: 'attendance_confirmation',
    name: 'Confirmacion de atencion',
    body: 'Hola {{cliente}}, confirmo tu atencion {{servicio}} para {{fecha}}. Cualquier cambio me avisas por este chat.'
  },
  {
    key: 'appointment_reminder',
    name: 'Recordatorio',
    body: 'Hola {{cliente}}, te recuerdo tu atencion {{servicio}} programada para {{fecha}}.'
  },
  {
    key: 'payment_pending',
    name: 'Pago pendiente',
    body: 'Hola {{cliente}}, queda pendiente el pago de {{monto}} por {{servicio}}. Puedes transferir cuando te acomode. Gracias.'
  }
];

@Injectable()
export class MessageTemplatesService {
  constructor(private prisma: PrismaService) {}

  async list(professionalId: string) {
    await this.ensureDefaults(professionalId);
    return this.prisma.messageTemplate.findMany({
      where: { professionalId },
      orderBy: { key: 'asc' }
    });
  }

  async ensureDefaults(professionalId: string) {
    for (const template of DEFAULT_TEMPLATES) {
      await this.prisma.messageTemplate.upsert({
        where: { professionalId_key: { professionalId, key: template.key } },
        update: {},
        create: { professionalId, ...template }
      });
    }

    return this.prisma.messageTemplate.findMany({
      where: { professionalId },
      orderBy: { key: 'asc' }
    });
  }

  async update(professionalId: string, id: string, body: any) {
    const existing = await this.prisma.messageTemplate.findFirst({ where: { id, professionalId } });
    if (!existing) throw new NotFoundException('Message template not found.');

    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        name: body.name,
        body: body.body,
        active: body.active
      }
    });
  }

  render(body: string, values: Record<string, string | number | null | undefined>) {
    return body.replace(/\{\{(\w+)\}\}/g, (_match, key) => String(values[key] ?? ''));
  }
}
