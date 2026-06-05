require('dotenv/config');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function postWebhook(text, fromPhone, phoneNumberId) {
  const apiUrl = process.env.FLUXIO_API_URL || 'http://localhost:3000/api';
  const payload = {
    data: {
      phone_number_id: phoneNumberId,
      from: fromPhone,
      message: {
        id: `wamid.assistant.${Date.now()}.${Math.random()}`,
        type: 'text',
        text: { body: text }
      }
    }
  };

  const res = await fetch(`${apiUrl}/kapso/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Event': 'whatsapp.message.received',
      'X-Webhook-Payload-Version': 'v2',
      'X-Idempotency-Key': `assistant-flow-${Date.now()}-${Math.random()}`
    },
    body: JSON.stringify(payload)
  });

  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

async function main() {
  const phoneNumberId = process.env.TEST_KAPSO_PHONE_NUMBER_ID || process.env.KAPSO_SANDBOX_PHONE_NUMBER_ID || 'fluxio-light-sandbox-phone';
  const professional = await prisma.professional.findFirst({ where: { email: 'admin@fluxiolight.local' } });
  if (!professional) throw new Error('Demo professional not found. Run npm run seed first.');

  const contact = await prisma.contact.findFirst({ where: { professionalId: professional.id, fullName: 'Ana Perez' } });
  if (!contact) throw new Error('Ana Perez contact not found. Run npm run seed first.');

  const originalPhone = professional.phone;
  const assistantPhone = '+56900000002';
  const testTitles = ['Prueba Assistant Flow', 'Curacion script aceptada'];

  await prisma.professional.update({ where: { id: professional.id }, data: { phone: assistantPhone } });
  await prisma.assistantPendingAction.deleteMany({ where: { professionalId: professional.id } });
  await cleanupTestData(professional.id, testTitles);

  try {
    const quoteCommand = await postWebhook('Cotizar: Ana Perez, Prueba Assistant Flow, $25000', assistantPhone, phoneNumberId);
    const pending = await prisma.assistantPendingAction.findFirst({
      where: { professionalId: professional.id, fromPhone: assistantPhone.replace(/[^\d]/g, '') },
      orderBy: { createdAt: 'desc' }
    });
    if (!pending || pending.type !== 'CONFIRM_SEND_QUOTE') {
      throw new Error(`Expected CONFIRM_SEND_QUOTE pending action, got ${JSON.stringify(pending)}`);
    }

    await postWebhook('no', assistantPhone, phoneNumberId);
    const pendingAfterCancel = await prisma.assistantPendingAction.count({ where: { professionalId: professional.id } });
    const cancelledQuote = await prisma.quote.findFirst({
      where: { professionalId: professional.id, title: 'Prueba Assistant Flow' },
      orderBy: { createdAt: 'desc' }
    });
    if (pendingAfterCancel !== 0 || cancelledQuote?.status !== 'CANCELLED') {
      throw new Error(`Cancel flow failed. pending=${pendingAfterCancel} quote=${JSON.stringify(cancelledQuote)}`);
    }

    const acceptedQuote = await prisma.quote.create({
      data: {
        professionalId: professional.id,
        contactId: contact.id,
        title: 'Curacion script aceptada',
        amount: 31000,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        message: 'Cotizacion aceptada por script'
      }
    });

    const listResult = await postWebhook('Cotizaciones aceptadas', assistantPhone, phoneNumberId);
    if (listResult.result?.command !== 'QUOTE_QUERY') {
      throw new Error(`Expected QUOTE_QUERY, got ${JSON.stringify(listResult.result)}`);
    }

    const convertResult = await postWebhook('Crear atencion desde cotizacion de Ana Perez', assistantPhone, phoneNumberId);
    const convertedQuote = await prisma.quote.findUnique({ where: { id: acceptedQuote.id }, include: { attendance: true } });
    if (convertResult.result?.command !== 'CONVERT_QUOTE' || convertedQuote?.status !== 'CONVERTED' || !convertedQuote?.attendance) {
      throw new Error(`Convert flow failed. result=${JSON.stringify(convertResult.result)} quote=${JSON.stringify(convertedQuote)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      quoteCommand: quoteCommand.result?.command,
      cancelledQuoteStatus: cancelledQuote.status,
      listCommand: listResult.result?.command,
      convertedQuoteStatus: convertedQuote.status,
      attendanceId: convertedQuote.attendance.id
    }, null, 2));
  } finally {
    await cleanupTestData(professional.id, testTitles);
    await prisma.professional.update({ where: { id: professional.id }, data: { phone: originalPhone } });
  }
}

async function cleanupTestData(professionalId, testTitles) {
  const attendances = await prisma.attendance.findMany({
    where: { professionalId, title: { in: testTitles } },
    select: { id: true }
  });
  const attendanceIds = attendances.map((item) => item.id);

  if (attendanceIds.length) {
    await prisma.incomeRecord.deleteMany({ where: { professionalId, attendanceId: { in: attendanceIds } } });
    await prisma.attendance.deleteMany({ where: { professionalId, id: { in: attendanceIds } } });
  }

  await prisma.quote.deleteMany({ where: { professionalId, title: { in: testTitles } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
