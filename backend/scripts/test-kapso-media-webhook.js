require('dotenv/config');

const crypto = require('crypto');
const http = require('http');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lLM2TAAAAABJRU5ErkJggg==',
  'base64'
);

async function startMediaServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/before.png') {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length });
      res.end(png);
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });

  await new Promise((resolve) => server.listen(3998, '0.0.0.0', resolve));
  return server;
}

async function main() {
  const server = await startMediaServer();
  const apiUrl = process.env.FLUXIO_API_URL || 'http://localhost:3000/api';
  const secret = process.env.KAPSO_WEBHOOK_SECRET || '';
  const kapsoMode = (process.env.KAPSO_MODE || 'sandbox').toLowerCase();
  const phoneNumberId =
    process.env.TEST_KAPSO_PHONE_NUMBER_ID ||
    process.env.KAPSO_SANDBOX_PHONE_NUMBER_ID ||
    'fluxio-light-sandbox-phone';

  try {
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
        id: `wamid.media.${Date.now()}`,
        timestamp: String(Math.floor(Date.now() / 1000)),
        type: 'image',
        from: '+56955555556',
        kapso: {
          direction: 'inbound',
          status: 'received',
          processing_status: 'pending',
          origin: kapsoMode === 'sandbox' ? 'sandbox' : 'cloud_api',
          has_media: true,
          media_url: 'http://host.docker.internal:3998/before.png',
          media_data: {
            filename: 'before.png',
            content_type: 'image/png'
          },
          message_type_data: {
            caption: 'before - foto inicial'
          }
        }
      },
      conversation: {
        id: `conv_media_${Date.now()}`,
        phone_number: '+56955555556',
        status: 'active',
        phone_number_id: phoneNumberId,
        kapso: {
          contact_name: 'Cliente Media',
          messages_count: 1,
          last_message_text: 'before - foto inicial'
        }
      },
      is_new_conversation: true,
      phone_number_id: phoneNumberId
    };

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': 'whatsapp.message.received',
      'X-Webhook-Payload-Version': 'v2',
      'X-Idempotency-Key': `media-test-${Date.now()}`
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
    const evidence = await prisma.evidenceFile.findFirst({
      where: { professionalId: professional.id, originalFileName: 'before.png' },
      orderBy: { createdAt: 'desc' }
    });

    console.log(JSON.stringify({
      status: res.status,
      body: body ? JSON.parse(body) : null,
      evidence: evidence && {
        id: evidence.id,
        type: evidence.type,
        category: evidence.category,
        storageProvider: evidence.storageProvider,
        publicUrl: evidence.publicUrl,
        contactId: evidence.contactId,
        leadId: evidence.leadId,
        conversationId: evidence.conversationId,
        messageId: evidence.messageId
      }
    }, null, 2));

    if (!res.ok || !evidence || evidence.storageProvider !== 'local' || evidence.category !== 'BEFORE') {
      process.exitCode = 1;
    }
  } finally {
    server.close();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
