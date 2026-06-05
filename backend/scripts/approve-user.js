require('dotenv/config');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    throw new Error('Uso: npm run admin:approve-user -- profesional@mail.com');
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { professional: true } });
  if (!user) throw new Error(`No existe usuario con email ${email}`);

  const updated = await prisma.user.update({
    where: { email },
    data: {
      accountStatus: 'ACTIVE',
      approvedAt: new Date()
    },
    include: { professional: true }
  });

  console.log(JSON.stringify({
    ok: true,
    email: updated.email,
    status: updated.accountStatus,
    professionalId: updated.professional?.id
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
