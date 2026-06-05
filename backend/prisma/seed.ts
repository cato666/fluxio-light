import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'admin@fluxiolight.local' },
    update: {
      passwordHash,
      name: 'Demo Fluxio Light',
      accountStatus: 'ACTIVE',
      approvedAt: new Date()
    },
    create: {
      email: 'admin@fluxiolight.local',
      name: 'Demo Fluxio Light',
      passwordHash,
      accountStatus: 'ACTIVE',
      approvedAt: new Date(),
      professional: {
        create: {
          displayName: 'Maria Gonzalez - TENS Independiente',
          profession: 'TENS',
          phone: '+56911111111',
          email: 'admin@fluxiolight.local'
        }
      }
    },
    include: { professional: true }
  });

  const professionalId = user.professional!.id;

  await prisma.professional.update({
    where: { id: professionalId },
    data: {
      kapsoCustomerId: null,
      assistantAllowedPhones: process.env.KAPSO_ASSISTANT_ALLOWED_PHONES || ''
    }
  });

  await prisma.evidenceFile.deleteMany({ where: { professionalId } });
  await prisma.assistantPendingAction.deleteMany({ where: { professionalId } });
  await prisma.whatsAppMessage.deleteMany({ where: { professionalId } });
  await prisma.whatsAppConversation.deleteMany({ where: { professionalId } });
  await prisma.whatsAppConnection.deleteMany({ where: { professionalId } });
  await prisma.incomeRecord.deleteMany({ where: { professionalId } });
  await prisma.attendance.deleteMany({ where: { professionalId } });
  await prisma.quote.deleteMany({ where: { professionalId } });
  await prisma.appointment.deleteMany({ where: { professionalId } });
  await prisma.lead.deleteMany({ where: { professionalId } });
  await prisma.expense.deleteMany({ where: { professionalId } });
  await prisma.contact.deleteMany({ where: { professionalId } });

  const ana = await prisma.contact.create({
    data: {
      professionalId,
      fullName: 'Ana Perez',
      phone: '+56922222222',
      commune: 'Maipu',
      source: 'Instagram'
    }
  });

  const juan = await prisma.contact.create({
    data: {
      professionalId,
      fullName: 'Juan Soto',
      phone: '+56933333333',
      commune: 'Nunoa',
      source: 'WhatsApp'
    }
  });

  await prisma.lead.createMany({
    data: [
      {
        professionalId,
        contactId: ana.id,
        title: 'Curacion simple a domicilio',
        description: 'Solicita disponibilidad para manana.',
        source: 'Instagram',
        status: 'SCHEDULED',
        estimatedValue: 25000
      },
      {
        professionalId,
        contactId: juan.id,
        title: 'Control de presion',
        description: 'Consulta por atencion semanal.',
        source: 'WhatsApp',
        status: 'NEW',
        estimatedValue: 18000
      }
    ]
  });

  await prisma.appointment.create({
    data: {
      professionalId,
      contactId: ana.id,
      title: 'Curacion simple',
      startsAt: new Date(),
      location: 'Maipu'
    }
  });

  const attendance = await prisma.attendance.create({
    data: {
      professionalId,
      contactId: ana.id,
      title: 'Curacion simple',
      description: 'Atencion demo registrada.',
      amount: 25000
    }
  });

  await prisma.incomeRecord.create({
    data: {
      professionalId,
      contactId: ana.id,
      attendanceId: attendance.id,
      description: 'Curacion simple - Ana Perez',
      amount: 25000,
      paymentStatus: 'PAID',
      paymentMethod: 'TRANSFER',
      paidAt: new Date()
    }
  });

  await prisma.expense.create({
    data: {
      professionalId,
      description: 'Insumos farmacia',
      amount: 8500,
      category: 'Insumos'
    }
  });

  console.log('Seed listo:', user.email);
}

main()
  .finally(async () => prisma.$disconnect());
