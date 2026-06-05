import { Injectable } from '@nestjs/common';

export type ParsedCommand =
  | { type: 'MENU' }
  | { type: 'MONTH_SUMMARY' }
  | { type: 'AGENDA_QUERY'; day: 'today' | 'tomorrow' }
  | { type: 'NEW_LEAD'; name?: string; description?: string; source?: string }
  | { type: 'REGISTER_ATTENDANCE'; name?: string; title?: string; amount?: number; paymentMethod?: string }
  | { type: 'REGISTER_EXPENSE'; description?: string; amount?: number }
  | { type: 'UPDATE_CONTACT_PHONE'; name?: string; phone?: string }
  | { type: 'CREATE_APPOINTMENT'; name?: string; startsAtText?: string; title?: string; location?: string }
  | { type: 'QUOTE'; name?: string; service?: string; amount?: number }
  | { type: 'QUOTE_QUERY'; status?: 'pending' | 'accepted' | 'rejected' | 'all'; name?: string }
  | { type: 'CONVERT_QUOTE'; name?: string }
  | { type: 'PAYMENT_QUERY'; name?: string }
  | { type: 'PAYMENT_RECEIVED'; name?: string; amount?: number; paymentMethod?: string }
  | { type: 'PAYMENT_REMINDER'; name?: string }
  | { type: 'UNKNOWN'; text: string };

@Injectable()
export class WhatsappCommandParserService {
  parse(text?: string): ParsedCommand {
    const raw = (text || '').trim();
    const lower = this.normalize(raw);

    if (!raw || ['menu', 'hola', 'inicio'].includes(lower)) return { type: 'MENU' };
    if (lower.includes('cuanto llevo') || lower.includes('resumen')) return { type: 'MONTH_SUMMARY' };
    if (lower.includes('agenda manana') || lower.includes('agenda mañana') || lower.includes('que tengo manana') || lower.includes('que tengo mañana')) {
      return { type: 'AGENDA_QUERY', day: 'tomorrow' };
    }
    if (lower.includes('que tengo hoy') || lower.includes('agenda hoy')) return { type: 'AGENDA_QUERY', day: 'today' };

    if (lower.startsWith('cotizaciones')) {
      const nameMatch = raw.match(/^cotizaciones\s+de\s+(.+)$/i);
      if (nameMatch?.[1]) return { type: 'QUOTE_QUERY', name: nameMatch[1].trim(), status: 'all' };
      if (lower.includes('aceptad')) return { type: 'QUOTE_QUERY', status: 'accepted' };
      if (lower.includes('rechazad')) return { type: 'QUOTE_QUERY', status: 'rejected' };
      if (lower.includes('pendient') || lower === 'cotizaciones') return { type: 'QUOTE_QUERY', status: 'pending' };
      return { type: 'QUOTE_QUERY', status: 'all' };
    }

    if (lower === 'pendientes de cobro' || lower === 'cobros pendientes' || lower === 'pagos pendientes') {
      return { type: 'PAYMENT_QUERY' };
    }

    const pendingPaymentMatch =
      raw.match(/^(?:pendientes\s+de\s+cobro|cobros\s+pendientes|pagos\s+pendientes)\s+de\s+(.+)$/i);
    if (pendingPaymentMatch?.[1]) {
      return { type: 'PAYMENT_QUERY', name: pendingPaymentMatch[1].trim() };
    }

    const paymentReminderMatch =
      raw.match(/^(?:cobrar|recordar\s+pago|enviar\s+cobro)\s+a\s+(.+)$/i);
    if (paymentReminderMatch?.[1]) {
      return { type: 'PAYMENT_REMINDER', name: paymentReminderMatch[1].trim() };
    }

    if (lower.startsWith('pago recibido') || lower.startsWith('registrar pago') || lower.startsWith('marcar pago')) {
      const payload = raw.split(':').slice(1).join(':').trim();
      const parts = payload.split(',').map((p) => p.trim()).filter(Boolean);
      const amountText = parts.find((p) => /\$?\d/.test(p));
      const amount = amountText ? Number(amountText.replace(/[^\d]/g, '')) : undefined;
      return {
        type: 'PAYMENT_RECEIVED',
        name: parts[0],
        amount,
        paymentMethod: parts.find((part) => !/\$?\d/.test(part) && part !== parts[0])
      };
    }

    if (lower.startsWith('crear atencion desde cotizacion') || lower.startsWith('convertir cotizacion')) {
      const nameMatch =
        raw.match(/^crear\s+atenci[oó]n\s+desde\s+cotizaci[oó]n\s+de\s+(.+)$/i) ||
        raw.match(/^convertir\s+cotizaci[oó]n\s+de\s+(.+?)\s+en\s+atenci[oó]n$/i) ||
        raw.match(/^convertir\s+cotizaci[oó]n\s+de\s+(.+)$/i) ||
        raw.match(/^convertir\s+cotizaci[oó]n\s+(.+)$/i);
      return { type: 'CONVERT_QUOTE', name: nameMatch?.[1]?.trim() };
    }

    if (lower.startsWith('nuevo lead')) {
      const payload = raw.split(':').slice(1).join(':').trim();
      const parts = payload.split(',').map((p) => p.trim());
      return { type: 'NEW_LEAD', name: parts[0], description: parts[1], source: parts[2] || 'WhatsApp' };
    }

    if (/^registrar atenci.n/.test(lower)) {
      const payload = raw.split(':').slice(1).join(':').trim();
      const parts = payload.split(',').map((p) => p.trim());
      const amountText = parts.find((p) => /\$?\d/.test(p));
      const amount = amountText ? Number(amountText.replace(/[^\d]/g, '')) : undefined;
      return { type: 'REGISTER_ATTENDANCE', name: parts[0], title: parts[1], amount, paymentMethod: parts[3] };
    }

    if (lower.startsWith('agregar telefono') || lower.startsWith('actualizar telefono')) {
      const payload = raw.split(':').slice(1).join(':').trim();
      const phonePart = payload.split(',').map((p) => p.trim()).find((part) => this.normalizePhone(part).length >= 8) || payload;
      const nameMatch = raw.match(/^(?:agregar|actualizar)\s+telefono\s+a\s+(.+?):/i);
      const name = nameMatch?.[1]?.trim() || payload.replace(phonePart || '', '').replace(/,$/, '').trim();
      return { type: 'UPDATE_CONTACT_PHONE', name: name.replace(/,$/, '').trim(), phone: phonePart };
    }

    if (lower.startsWith('agendar')) {
      const payload = raw.split(':').slice(1).join(':').trim();
      const parts = payload.split(',').map((p) => p.trim());
      return {
        type: 'CREATE_APPOINTMENT',
        name: parts[0],
        startsAtText: parts[1],
        title: parts[2],
        location: parts[3]
      };
    }

    if (lower.startsWith('cotizar')) {
      const payload = raw.split(':').slice(1).join(':').trim();
      const parts = payload.split(',').map((p) => p.trim());
      const amountText = parts.find((p) => /\$?\d/.test(p));
      const amount = amountText ? Number(amountText.replace(/[^\d]/g, '')) : undefined;
      return { type: 'QUOTE', name: parts[0], service: parts[1], amount };
    }

    if (lower.startsWith('registrar gasto')) {
      const payload = raw.split(':').slice(1).join(':').trim();
      const amountMatch = payload.match(/\$?\s*([\d.]+)/);
      return {
        type: 'REGISTER_EXPENSE',
        description: payload.replace(/\$?\s*[\d.]+/g, '').trim(),
        amount: amountMatch ? Number(amountMatch[1].replace(/\./g, '')) : undefined
      };
    }

    return { type: 'UNKNOWN', text: raw };
  }

  private normalize(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private normalizePhone(value?: string) {
    return (value || '').replace(/[^\d]/g, '');
  }
}
