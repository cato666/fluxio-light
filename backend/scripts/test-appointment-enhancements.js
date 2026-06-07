require('dotenv/config');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const apiUrl = process.env.FLUXIO_API_URL || 'http://localhost:3000/api';

async function api(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, options);
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}
  return { response, body, text };
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

  const professional = await prisma.professional.findFirst({ where: { email: 'admin@fluxiolight.local' } });
  if (!professional) throw new Error('Demo professional not found. Run npm run seed first.');

  const marker = `Agenda enhancement test ${Date.now()}`;
  const contact = await prisma.contact.create({
    data: {
      professionalId: professional.id,
      fullName: marker,
      source: 'Automated test'
    }
  });
  const appointment = await prisma.appointment.create({
    data: {
      professionalId: professional.id,
      contactId: contact.id,
      title: marker,
      description: 'Validacion de calendario y recordatorio seguro',
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
      location: 'Domicilio'
    }
  });

  const headers = { Authorization: `Bearer ${login.body.accessToken}` };

  try {
    const calendar = await api(`/appointments/${appointment.id}/calendar.ics`, { headers });
    if (!calendar.response.ok || !calendar.text.includes('BEGIN:VCALENDAR') || !calendar.text.includes('BEGIN:VEVENT')) {
      throw new Error(`ICS generation failed: ${calendar.response.status} ${calendar.text}`);
    }

    const reminder = await api(`/appointments/${appointment.id}/send-reminder`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (reminder.response.status !== 400) {
      throw new Error(`Reminder phone guard failed: ${reminder.response.status} ${JSON.stringify(reminder.body)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      calendar: 'generated',
      reminderGuard: reminder.body.message
    }, null, 2));
  } finally {
    await prisma.appointment.deleteMany({ where: { id: appointment.id } });
    await prisma.contact.deleteMany({ where: { id: contact.id } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
