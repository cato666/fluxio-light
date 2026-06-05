require('dotenv/config');

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const apiUrl = process.env.FLUXIO_API_URL || 'http://localhost:3000/api';
  const secret = process.env.KAPSO_WEBHOOK_SECRET || '';
  const kapsoMode = (process.env.KAPSO_MODE || 'sandbox').toLowerCase();
  const phoneNumberId =
    process.env.TEST_KAPSO_PHONE_NUMBER_ID ||
    process.env.KAPSO_SANDBOX_PHONE_NUMBER_ID ||
    'fluxio-light-sandbox-phone';

  const professional = await prisma.professional.findFirst({
    where: { email: 'admin@fluxiolight.local' }
  });

  if (!professional) {
    throw new Error('Demo professional not found. Run npm run seed first.');
  }

  if (kapsoMode !== 'sandbox') {
    await prisma.whatsAppConnection.upsert({
      where: { phoneNumberId },
      update: {
        professionalId: professional.id,
        status: 'connected',
        displayPhone: '+56911111111',
        lastError: null
      },
      create: {
        professionalId: professional.id,
        phoneNumberId,
        status: 'connected',
        displayPhone: '+56911111111'
      }
    });
  }

  const payload = {
    message: {
      id: `wamid.test.${Date.now()}`,
      timestamp: String(Math.floor(Date.now() / 1000)),
      type: 'text',
      from: '+56955555555',
      text: { body: 'Hola, necesito una hora para curacion' },
      kapso: {
        direction: 'inbound',
        status: 'received',
        processing_status: 'pending',
        origin: kapsoMode === 'sandbox' ? 'sandbox' : 'cloud_api',
        has_media: false,
        content: 'Hola, necesito una hora para curacion'
      }
    },
    conversation: {
      id: `conv_test_${Date.now()}`,
      phone_number: '+56955555555',
      status: 'active',
      phone_number_id: phoneNumberId,
      kapso: {
        contact_name: 'Cliente Simulado',
        messages_count: 1,
        last_message_text: 'Hola, necesito una hora para curacion'
      }
    },
    is_new_conversation: true,
    phone_number_id: phoneNumberId
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': 'whatsapp.message.received',
    'X-Webhook-Payload-Version': 'v2',
    'X-Idempotency-Key': `test-${Date.now()}`
  };

  if (secret && !secret.startsWith('replace')) {
    headers['X-Webhook-Signature'] = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  }

  const res = await fetch(`${apiUrl}/kapso/webhook`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const body = await res.text();
  console.log(JSON.stringify({ status: res.status, body: body ? JSON.parse(body) : null }, null, 2));

  if (!res.ok) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
