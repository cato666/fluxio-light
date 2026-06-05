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
        id: `wamid.payments.${Date.now()}.${Math.random()}`,
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
      'X-Idempotency-Key': `payments-flow-${Date.now()}-${Math.random()}`
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
  const assistantPhone = '+56900000003';
  const description = 'Cobro script WhatsApp';

  await prisma.professional.update({ where: { id: professional.id }, data: { phone: assistantPhone } });
  await prisma.assistantPendingAction.deleteMany({ where: { professionalId: professional.id } });
  await prisma.incomeRecord.deleteMany({ where: { professionalId: professional.id, description } });

  try {
    const income = await prisma.incomeRecord.create({
      data: {
        professionalId: professional.id,
        contactId: contact.id,
        description,
        amount: 25000,
        paymentStatus: 'PENDING',
        paymentMethod: 'OTHER'
      }
    });

    const queryResult = await postWebhook('Pendientes de cobro de Ana Perez', assistantPhone, phoneNumberId);
    if (queryResult.result?.command !== 'PAYMENT_QUERY') {
      throw new Error(`Expected PAYMENT_QUERY, got ${JSON.stringify(queryResult.result)}`);
    }

    const paidResult = await postWebhook('Pago recibido: Ana Perez, $25000, transferencia', assistantPhone, phoneNumberId);
    const updated = await prisma.incomeRecord.findUnique({ where: { id: income.id } });
    if (paidResult.result?.command !== 'PAYMENT_RECEIVED' || updated?.paymentStatus !== 'PAID' || updated?.paymentMethod !== 'TRANSFER') {
      throw new Error(`Payment flow failed. result=${JSON.stringify(paidResult.result)} income=${JSON.stringify(updated)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      queryCommand: queryResult.result.command,
      paymentCommand: paidResult.result.command,
      paymentStatus: updated.paymentStatus,
      paymentMethod: updated.paymentMethod
    }, null, 2));
  } finally {
    await prisma.incomeRecord.deleteMany({ where: { professionalId: professional.id, description } });
    await prisma.professional.update({ where: { id: professional.id }, data: { phone: originalPhone } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
