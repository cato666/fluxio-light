import { Injectable } from '@nestjs/common';

@Injectable()
export class WhatsappResponseBuilderService {
  menu() {
    return [
      'Hola, soy Fluxio Light.',
      '',
      'Puedes escribirme comandos privados como:',
      'Registrar atencion: Ana Perez, curacion, $25000, transferencia',
      'Cotizar: Ana Perez, curacion a domicilio, $25000',
      'Cotizar PDF para mi: Ana Perez, curacion a domicilio, $25000',
      'Cotizaciones pendientes',
      'Cotizaciones de Ana Perez',
      'Crear atencion desde cotizacion de Ana Perez',
      'Pendientes de cobro',
      'Pago recibido: Ana Perez, $25000, transferencia',
      'Cobrar a Ana Perez',
      'Agendar: Ana Perez, 2026-05-29 10:00, control presion, domicilio',
      'Agenda hoy',
      'Agregar telefono a Ana Perez: +56912345678',
      'Nuevo lead: Carolina, cuidado adulto mayor, Instagram',
      'Registrar gasto: insumos farmacia $8500',
      'Resumen del mes'
    ].join('\n');
  }

  leadCreated(name?: string) {
    return `Lead registrado.${name ? `\nNombre: ${name}` : ''}`;
  }

  attendanceCreated(title?: string, amount?: number, contactName?: string | null) {
    return [
      'Atencion registrada.',
      contactName ? `Cliente: ${contactName}` : undefined,
      title || 'Servicio',
      amount ? `Ingreso: $${amount.toLocaleString('es-CL')}` : undefined
    ].filter(Boolean).join('\n');
  }

  confirmCreateContact(nameOrPhone: string, commandLabel: string) {
    return [
      `No encontre a "${nameOrPhone}" en tus clientes.`,
      `Lo creo como cliente nuevo para ${commandLabel}?`,
      '',
      'Responde "si" para crear o "no" para cancelar.'
    ].join('\n');
  }

  ambiguousContact(
    matches: Array<{ fullName?: string | null; phone?: string | null; source?: string | null; commune?: string | null }>,
    commandLabel = 'continuar'
  ) {
    return [
      'Encontre mas de un cliente posible.',
      `Responde con el numero correcto para ${commandLabel}:`,
      '',
      ...matches.slice(0, 5).map((contact, index) => this.contactOption(contact, index)),
      '',
      'Tambien puedes escribir "cancelar".'
    ].join('\n');
  }

  invalidPendingResponse() {
    return 'No pude interpretar la respuesta. Responde con un numero de la lista, "si", "no" o "cancelar".';
  }

  pendingCancelled() {
    return 'Listo, cancele la accion pendiente.';
  }

  expenseCreated(amount?: number) {
    return `Gasto registrado.${amount ? `\nMonto: $${amount.toLocaleString('es-CL')}` : ''}`;
  }

  paymentReceived(contactName?: string | null, amount?: number | null, status?: string | null) {
    return [
      'Pago registrado.',
      contactName ? `Cliente: ${contactName}` : undefined,
      amount ? `Monto: $${Number(amount).toLocaleString('es-CL')}` : undefined,
      status ? `Estado: ${status}` : undefined
    ].filter(Boolean).join('\n');
  }

  noPendingPayments(contactName?: string | null) {
    return `No encontre cobros pendientes${contactName ? ` para ${contactName}` : ''}.`;
  }

  paymentList(title: string, rows: Array<{ description?: string | null; amount?: number | null; paymentStatus?: string | null; contact?: { fullName?: string | null; phone?: string | null } | null; attendance?: { title?: string | null } | null }>) {
    if (!rows.length) return `${title}:\n\nSin pendientes.`;

    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return [
      `${title}:`,
      `Total: $${total.toLocaleString('es-CL')}`,
      '',
      ...rows.slice(0, 8).map((row, index) => {
        const contact = row.contact?.fullName || row.contact?.phone || 'Sin cliente';
        const description = row.description || row.attendance?.title || 'Ingreso pendiente';
        const amount = `$${Number(row.amount || 0).toLocaleString('es-CL')}`;
        return `${index + 1}. ${contact} - ${description} - ${amount} - ${row.paymentStatus}`;
      })
    ].join('\n');
  }

  paymentReminderSent(contactName?: string | null, simulated?: boolean) {
    return `Cobro enviado${contactName ? ` a ${contactName}` : ''}${simulated ? ' (simulado)' : ''}.`;
  }

  paymentReminderFailed(contactName?: string | null) {
    return `No pude enviar el cobro${contactName ? ` a ${contactName}` : ''}. Revisa telefono del cliente y conexion Kapso.`;
  }

  paymentNeedsPhone(contactName?: string | null) {
    return `No puedo enviar el cobro porque ${contactName || 'el cliente'} no tiene telefono. Usa: Agregar telefono a ${contactName || 'cliente'}: +569...`;
  }

  phoneUpdated(name?: string | null, phone?: string | null) {
    return [
      'Telefono actualizado.',
      name ? `Cliente: ${name}` : undefined,
      phone ? `Telefono: ${phone}` : undefined
    ].filter(Boolean).join('\n');
  }

  missingPhone() {
    return 'Necesito el telefono. Ejemplo: Agregar telefono a Ana Perez: +56912345678';
  }

  appointmentCreated(contactName?: string | null, title?: string | null, startsAt?: Date | string, location?: string | null) {
    return [
      'Cita agendada.',
      contactName ? `Cliente: ${contactName}` : undefined,
      title ? `Motivo: ${title}` : undefined,
      startsAt ? `Fecha: ${this.formatDateTime(startsAt)}` : undefined,
      location ? `Lugar: ${location}` : undefined
    ].filter(Boolean).join('\n');
  }

  quoteConfirmation(contactName: string | null | undefined, service: string | null | undefined, amount?: number) {
    return [
      `Cotizacion lista para ${contactName || 'el cliente'}:`,
      service || 'Servicio por confirmar',
      amount ? `Valor: $${amount.toLocaleString('es-CL')}` : 'Valor: por confirmar',
      '',
      'Enviar al cliente?',
      'Responde "si" para enviar o "no" para cancelar.'
    ].join('\n');
  }

  quoteSent(contactName?: string | null) {
    return `Cotizacion enviada${contactName ? ` a ${contactName}` : ''}.`;
  }

  quotePdfSentToProfessional(contactName?: string | null, simulated?: boolean) {
    return `PDF preparado${contactName ? ` para ${contactName}` : ''} y enviado a este chat${simulated ? ' (simulado)' : ''}. Puedes reenviarlo desde tu WhatsApp.`;
  }

  quoteSendFailed(contactName?: string | null) {
    return `No pude enviar la cotizacion${contactName ? ` a ${contactName}` : ''}. Revisa que el cliente tenga telefono valido y que Kapso este conectado.`;
  }

  quoteNeedsPhone(contactName?: string | null) {
    return `No puedo enviar la cotizacion porque ${contactName || 'el cliente'} no tiene telefono. Usa: Agregar telefono a ${contactName || 'cliente'}: +569...`;
  }

  quoteMessage(contactName: string | null | undefined, service: string | null | undefined, amount?: number) {
    return [
      `Hola ${contactName || ''}`.trim() + ', te comparto la cotizacion:',
      '',
      `Servicio: ${service || 'por confirmar'}`,
      `Valor: ${amount ? `$${amount.toLocaleString('es-CL')}` : 'por confirmar'}`,
      '',
      'Si estas de acuerdo, responde por este chat y coordinamos la atencion.'
    ].join('\n');
  }

  quoteAcceptedByCustomer(service?: string | null) {
    return [
      'Perfecto, dejamos registrada tu aceptacion.',
      service ? `Cotizacion: ${service}` : undefined,
      'Te contactaremos para coordinar la atencion.'
    ].filter(Boolean).join('\n');
  }

  quoteRejectedByCustomer(service?: string | null) {
    return [
      'Gracias por avisar.',
      service ? `Dejamos la cotizacion "${service}" como rechazada.` : 'Dejamos la cotizacion como rechazada.'
    ].filter(Boolean).join('\n');
  }

  quoteList(title: string, quotes: Array<{ title?: string | null; amount?: number | null; status?: string | null; contact?: { fullName?: string | null; phone?: string | null } | null; createdAt?: Date | string; sentAt?: Date | string | null }>) {
    if (!quotes.length) return `${title}:\n\nSin cotizaciones.`;

    return [
      `${title}:`,
      '',
      ...quotes.slice(0, 8).map((quote, index) => {
        const contact = quote.contact?.fullName || quote.contact?.phone || 'Sin cliente';
        const amount = quote.amount ? `$${Number(quote.amount).toLocaleString('es-CL')}` : 'sin monto';
        return `${index + 1}. ${contact} - ${quote.title || 'Cotizacion'} - ${amount} - ${quote.status}`;
      })
    ].join('\n');
  }

  quoteConverted(contactName?: string | null, title?: string | null, amount?: number | null) {
    return [
      'Atencion creada desde cotizacion.',
      contactName ? `Cliente: ${contactName}` : undefined,
      title ? `Servicio: ${title}` : undefined,
      amount ? `Ingreso: $${Number(amount).toLocaleString('es-CL')}` : undefined
    ].filter(Boolean).join('\n');
  }

  noAcceptedQuote(contactName?: string | null) {
    return `No encontre una cotizacion aceptada${contactName ? ` para ${contactName}` : ''}. Puedes revisar con: Cotizaciones de ${contactName || 'cliente'}.`;
  }

  invalidAppointmentDate() {
    return 'Necesito fecha y hora. Ejemplo: Agendar: Ana Perez, 2026-05-29 10:00, control presion, domicilio';
  }

  agendaList(dayLabel: string, appointments: Array<{ startsAt: Date | string; title?: string | null; location?: string | null; contact?: { fullName?: string | null } | null }>) {
    if (!appointments.length) return `No tienes citas en agenda ${dayLabel}.`;

    return [
      `Agenda ${dayLabel}:`,
      '',
      ...appointments.map((appointment) => {
        const time = this.formatTime(appointment.startsAt);
        const contact = appointment.contact?.fullName || 'Sin cliente';
        const location = appointment.location ? ` - ${appointment.location}` : '';
        return `${time} - ${contact} - ${appointment.title || 'Cita'}${location}`;
      })
    ].join('\n');
  }

  evidenceReceived() {
    return [
      'Recibi un archivo.',
      'Quedo guardado como evidencia general.',
      '',
      'Luego podras clasificarlo como foto antes, foto despues, comprobante, dano detectado o documento.'
    ].join('\n');
  }

  missingContactTarget() {
    return 'Necesito el nombre o telefono del cliente. Ejemplo: Registrar atencion: Ana Perez, curacion, $25000, transferencia';
  }

  contactOption(contact: { fullName?: string | null; phone?: string | null; source?: string | null; commune?: string | null }, index: number) {
    const parts = [
      `${index + 1}. ${contact.fullName || 'Sin nombre'}`,
      contact.phone || 'sin telefono',
      contact.commune ? `comuna: ${contact.commune}` : undefined,
      contact.source ? `origen: ${contact.source}` : undefined
    ];

    return parts.filter(Boolean).join(' | ');
  }

  unknown() {
    return 'No entendi completamente el mensaje. Escribe "menu" para ver opciones.';
  }

  private formatDateTime(value: Date | string) {
    return new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  private formatTime(value: Date | string) {
    return new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }
}
