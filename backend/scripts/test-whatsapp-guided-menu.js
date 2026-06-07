require('dotenv/config');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function postWebhook(text, fromPhone, phoneNumberId) {
  const apiUrl = process.env.FLUXIO_API_URL || 'http://localhost:3000/api';
  const res = await fetch(`${apiUrl}/kapso/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Event': 'whatsapp.message.received',
      'X-Webhook-Payload-Version': 'v2',
      'X-Idempotency-Key': `guided-menu-${Date.now()}-${Math.random()}`
    },
    body: JSON.stringify({
      data: {
        phone_number_id: phoneNumberId,
        from: fromPhone,
        message: {
          id: `wamid.guided.${Date.now()}.${Math.random()}`,
          type: 'text',
          text: { body: text }
        }
      }
    })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

async function pendingType(professionalId, fromPhone) {
  const pending = await prisma.assistantPendingAction.findFirst({
    where: { professionalId, fromPhone: fromPhone.replace(/[^\d]/g, '') },
    orderBy: { updatedAt: 'desc' }
  });
  return pending?.type || null;
}

async function main() {
  const phoneNumberId = process.env.TEST_KAPSO_PHONE_NUMBER_ID
    || process.env.KAPSO_SANDBOX_PHONE_NUMBER_ID
    || 'fluxio-light-sandbox-phone';
  const professional = await prisma.professional.findFirst({
    where: { email: 'admin@fluxiolight.local' }
  });
  if (!professional) throw new Error('Demo professional not found. Run npm run seed first.');

  const assistantPhone = '+56900000004';
  const contactName = 'Cliente Menu Guiado';
  const attendanceTitle = 'Atencion menu guiado';
  const expenseDescription = 'Gasto menu guiado';
  const quoteTitle = 'Cotizacion menu guiado';
  const appointmentTitle = 'Agenda menu guiado';
  const originalPhone = professional.phone;

  await prisma.professional.update({ where: { id: professional.id }, data: { phone: assistantPhone } });
  await prisma.assistantPendingAction.deleteMany({ where: { professionalId: professional.id } });
  await cleanup(professional.id, contactName, attendanceTitle, expenseDescription, quoteTitle, appointmentTitle);
  const contact = await prisma.contact.create({
    data: {
      professionalId: professional.id,
      fullName: contactName,
      phone: '+56900000044',
      source: 'Guided menu test'
    }
  });

  try {
    await postWebhook('menu', assistantPhone, phoneNumberId);
    if (await pendingType(professional.id, assistantPhone) !== 'GUIDED_MENU') throw new Error('Menu was not opened.');

    await postWebhook('1', assistantPhone, phoneNumberId);
    await postWebhook(contactName, assistantPhone, phoneNumberId);
    await postWebhook(attendanceTitle, assistantPhone, phoneNumberId);
    await postWebhook('25000', assistantPhone, phoneNumberId);
    await postWebhook('1', assistantPhone, phoneNumberId);
    await postWebhook('1', assistantPhone, phoneNumberId);

    const attendance = await prisma.attendance.findFirst({
      where: { professionalId: professional.id, contactId: contact.id, title: attendanceTitle },
      include: { incomeRecord: true }
    });
    if (!attendance || attendance.amount !== 25000 || attendance.incomeRecord?.paymentMethod !== 'TRANSFER') {
      throw new Error(`Attendance flow failed: ${JSON.stringify(attendance)}`);
    }

    await postWebhook('menu', assistantPhone, phoneNumberId);
    await postWebhook('4', assistantPhone, phoneNumberId);
    await postWebhook(expenseDescription, assistantPhone, phoneNumberId);
    await postWebhook('8500', assistantPhone, phoneNumberId);
    await postWebhook('1', assistantPhone, phoneNumberId);

    const expense = await prisma.expense.findFirst({
      where: { professionalId: professional.id, description: expenseDescription }
    });
    if (!expense || expense.amount !== 8500) throw new Error(`Expense flow failed: ${JSON.stringify(expense)}`);

    await postWebhook('menu', assistantPhone, phoneNumberId);
    await postWebhook('2', assistantPhone, phoneNumberId);
    await postWebhook(contactName, assistantPhone, phoneNumberId);
    await postWebhook(quoteTitle, assistantPhone, phoneNumberId);
    await postWebhook('30000', assistantPhone, phoneNumberId);
    await postWebhook('4', assistantPhone, phoneNumberId);
    const quotePendingBeforeConfirm = await prisma.assistantPendingAction.findFirst({
      where: { professionalId: professional.id },
      orderBy: { updatedAt: 'desc' }
    });
    const quoteConfirmationResult = await postWebhook('1', assistantPhone, phoneNumberId);

    const quote = await prisma.quote.findFirst({
      where: { professionalId: professional.id, contactId: contact.id, title: quoteTitle }
    });
    if (!quote || quote.amount !== 30000 || quote.status !== 'DRAFT') {
      const debugPending = await prisma.assistantPendingAction.findFirst({
        where: { professionalId: professional.id },
        orderBy: { updatedAt: 'desc' }
      });
      const debugQuotes = await prisma.quote.findMany({
        where: { professionalId: professional.id, contactId: contact.id },
        orderBy: { createdAt: 'desc' },
        take: 3
      });
      throw new Error(`Quote flow failed: before=${JSON.stringify(quotePendingBeforeConfirm)} result=${JSON.stringify(quoteConfirmationResult)} quote=${JSON.stringify(quote)} pending=${JSON.stringify(debugPending)} recent=${JSON.stringify(debugQuotes)}`);
    }

    await postWebhook('menu', assistantPhone, phoneNumberId);
    await postWebhook('3', assistantPhone, phoneNumberId);
    await postWebhook(contactName, assistantPhone, phoneNumberId);
    await postWebhook('manana 10:30', assistantPhone, phoneNumberId);
    await postWebhook(appointmentTitle, assistantPhone, phoneNumberId);
    await postWebhook('domicilio', assistantPhone, phoneNumberId);
    await postWebhook('1', assistantPhone, phoneNumberId);

    const appointment = await prisma.appointment.findFirst({
      where: { professionalId: professional.id, contactId: contact.id, title: appointmentTitle }
    });
    if (!appointment || appointment.location !== 'domicilio') {
      throw new Error(`Appointment flow failed: ${JSON.stringify(appointment)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      attendanceId: attendance.id,
      incomeId: attendance.incomeRecord.id,
      expenseId: expense.id,
      quoteId: quote.id,
      quoteStatus: quote.status,
      appointmentId: appointment.id,
      finalPending: await pendingType(professional.id, assistantPhone)
    }, null, 2));
  } finally {
    await cleanup(professional.id, contactName, attendanceTitle, expenseDescription, quoteTitle, appointmentTitle);
    await prisma.professional.update({ where: { id: professional.id }, data: { phone: originalPhone } });
  }
}

async function cleanup(professionalId, contactName, attendanceTitle, expenseDescription, quoteTitle, appointmentTitle) {
  const attendances = await prisma.attendance.findMany({
    where: { professionalId, title: attendanceTitle },
    select: { id: true }
  });
  const attendanceIds = attendances.map((item) => item.id);
  if (attendanceIds.length) {
    await prisma.incomeRecord.deleteMany({ where: { attendanceId: { in: attendanceIds } } });
    await prisma.attendance.deleteMany({ where: { id: { in: attendanceIds } } });
  }
  await prisma.expense.deleteMany({ where: { professionalId, description: expenseDescription } });
  await prisma.quote.deleteMany({ where: { professionalId, title: quoteTitle } });
  await prisma.appointment.deleteMany({ where: { professionalId, title: appointmentTitle } });
  await prisma.contact.deleteMany({ where: { professionalId, fullName: contactName } });
  await prisma.assistantPendingAction.deleteMany({ where: { professionalId } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
