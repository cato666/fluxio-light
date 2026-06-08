require('dotenv/config');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const apiUrl = process.env.FLUXIO_API_URL || 'http://localhost:3000/api';

async function main() {
  const marker = Date.now();
  const email = `admin-notify-${marker}@fluxio.test`;
  const res = await fetch(`${apiUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'admin12345',
      displayName: 'Admin Notify Test',
      profession: 'Prueba',
      phone: '+56900000099'
    })
  });
  const body = await res.json();
  if (!res.ok || body.status !== 'PENDING_APPROVAL') {
    throw new Error(`Register failed: ${res.status} ${JSON.stringify(body)}`);
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { professional: true } });
  if (!user?.professional) throw new Error('Registered professional was not created.');

  const event = await prisma.auditLog.findFirst({
    where: {
      professionalId: user.professional.id,
      action: 'ADMIN_EVENT_RECORDED',
      entity: 'User',
      entityId: user.id
    },
    orderBy: { createdAt: 'desc' }
  });
  if (!event || event.metadata?.type !== 'PROFESSIONAL_REGISTERED') {
    throw new Error(`Admin notification audit was not recorded: ${JSON.stringify(event)}`);
  }

  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { professionalId: user.professional.id } }),
    prisma.messageTemplate.deleteMany({ where: { professionalId: user.professional.id } }),
    prisma.professional.delete({ where: { id: user.professional.id } }),
    prisma.user.delete({ where: { id: user.id } })
  ]);

  console.log(JSON.stringify({
    ok: true,
    eventType: event.metadata.type,
    userStatus: body.status
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
