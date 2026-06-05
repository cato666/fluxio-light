require('dotenv/config');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function postWebhook(payload, eventType = 'whatsapp.message.received') {
  const apiUrl = process.env.FLUXIO_API_URL || 'http://localhost:3000/api';
  const res = await fetch(`${apiUrl}/kapso/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Event': eventType,
      'X-Webhook-Payload-Version': 'v2',
      'X-Idempotency-Key': `anti-loop-${Date.now()}-${Math.random()}`
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

  const originalPhone = professional.phone;
  const assistantPhone = '+56900000001';

  await prisma.professional.update({ where: { id: professional.id }, data: { phone: assistantPhone } });

  try {
    const outboundEvent = await postWebhook({
      message: {
        id: `wamid.outbound.${Date.now()}`,
        type: 'text',
        from: assistantPhone,
        to: '+56922222222',
        text: { body: 'Cotizaciones pendientes:\n\nSin cotizaciones.' },
        kapso: { direction: 'outbound', status: 'sent', content: 'Cotizaciones pendientes:\n\nSin cotizaciones.' }
      },
      phone_number_id: phoneNumberId
    }, 'whatsapp.message.sent');

    if (outboundEvent.result?.reason !== 'outbound_or_status_event') {
      throw new Error(`Expected outbound_or_status_event, got ${JSON.stringify(outboundEvent.result)}`);
    }

    const before = await prisma.whatsAppMessage.count();
    const generatedEcho = await postWebhook({
      data: {
        phone_number_id: phoneNumberId,
        from: assistantPhone,
        message: {
          id: `wamid.echo.${Date.now()}`,
          type: 'text',
          text: { body: 'Cotizaciones pendientes:\n\nSin cotizaciones.' }
        }
      }
    });
    const after = await prisma.whatsAppMessage.count();

    if (generatedEcho.result?.reason !== 'generated_reply_echo') {
      throw new Error(`Expected generated_reply_echo, got ${JSON.stringify(generatedEcho.result)}`);
    }
    if (after !== before) {
      throw new Error(`Generated echo should not be saved as a message. Before=${before} After=${after}`);
    }

    console.log(JSON.stringify({
      ok: true,
      outboundReason: outboundEvent.result.reason,
      generatedEchoReason: generatedEcho.result.reason
    }, null, 2));
  } finally {
    await prisma.professional.update({ where: { id: professional.id }, data: { phone: originalPhone } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
