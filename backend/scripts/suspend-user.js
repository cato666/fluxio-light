require('dotenv/config');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    throw new Error('Uso: npm run admin:suspend-user -- profesional@mail.com');
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { accountStatus: 'SUSPENDED' }
  });

  console.log(JSON.stringify({
    ok: true,
    email: updated.email,
    status: updated.accountStatus
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
