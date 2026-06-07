require('dotenv/config');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const apiUrl = process.env.FLUXIO_API_URL || 'http://localhost:3000/api';

async function api(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function main() {
  const login = await api('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.TEST_ADMIN_EMAIL || 'admin@fluxiolight.local',
      password: process.env.TEST_ADMIN_PASSWORD || 'admin123'
    })
  });
  if (!login.response.ok || !login.body.accessToken) {
    throw new Error(`Admin login failed: ${JSON.stringify(login.body)}`);
  }

  const professional = await prisma.professional.findFirst({
    where: { email: 'admin@fluxiolight.local' }
  });
  if (!professional) throw new Error('Demo professional not found. Run npm run seed first.');

  const marker = `health-test-${Date.now()}`;
  const created = await Promise.all([
    prisma.whatsAppMessage.create({
      data: {
        professionalId: professional.id,
        direction: 'OUTBOUND',
        outboundStatus: 'FAILED',
        outboundSource: marker,
        outboundError: 'Simulated health test failure',
        failedAt: new Date(),
        fromPhone: '56920403095',
        toPhone: '56900000991',
        type: 'text',
        text: 'Mensaje de prueba controlada',
        retryCount: 3
      }
    }),
    prisma.whatsAppMessage.create({
      data: {
        professionalId: professional.id,
        direction: 'OUTBOUND',
        outboundStatus: 'SENT',
        outboundSource: marker,
        sentAt: new Date(),
        fromPhone: '56920403095',
        toPhone: '56900000992',
        type: 'text',
        text: 'Mensaje ya enviado'
      }
    })
  ]);

  const headers = {
    Authorization: `Bearer ${login.body.accessToken}`,
    'Content-Type': 'application/json'
  };

  try {
    const health = await api('/platform-admin/whatsapp-health', { headers });
    if (!health.response.ok || health.body.last24Hours?.failed < 1) {
      throw new Error(`Health summary failed: ${JSON.stringify(health.body)}`);
    }

    const maxRetry = await api(`/platform-admin/outbound-messages/${created[0].id}/retry`, {
      method: 'POST',
      headers,
      body: '{}'
    });
    if (maxRetry.response.status !== 400) {
      throw new Error(`Max retry guard failed: ${maxRetry.response.status} ${JSON.stringify(maxRetry.body)}`);
    }

    const sentRetry = await api(`/platform-admin/outbound-messages/${created[1].id}/retry`, {
      method: 'POST',
      headers,
      body: '{}'
    });
    if (sentRetry.response.status !== 400) {
      throw new Error(`Sent message guard failed: ${sentRetry.response.status} ${JSON.stringify(sentRetry.body)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      healthStatus: health.body.status,
      failedLast24Hours: health.body.last24Hours.failed,
      maxRetryGuard: maxRetry.body.message,
      sentMessageGuard: sentRetry.body.message
    }, null, 2));
  } finally {
    await prisma.whatsAppMessage.deleteMany({ where: { outboundSource: marker } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
