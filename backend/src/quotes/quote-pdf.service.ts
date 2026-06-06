import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class QuotePdfService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  async generate(professionalId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, professionalId },
      include: { contact: true, professional: true }
    });
    if (!quote) throw new NotFoundException('Quote not found.');

    const latest = await this.prisma.quoteDocument.findFirst({
      where: { quoteId },
      orderBy: { version: 'desc' }
    });
    const version = (latest?.version || 0) + 1;
    const generatedAt = new Date();
    const validUntil = new Date(generatedAt);
    validUntil.setDate(validUntil.getDate() + quote.validityDays);
    const fileName = `cotizacion-${this.slug(quote.contact?.fullName || quote.title)}-v${version}.pdf`;
    const snapshot = {
      quoteId: quote.id,
      version,
      generatedAt: generatedAt.toISOString(),
      validUntil: validUntil.toISOString(),
      professional: {
        displayName: quote.professional.displayName,
        profession: quote.professional.profession,
        phone: quote.professional.phone,
        email: quote.professional.email,
        currency: quote.professional.currency
      },
      contact: {
        fullName: quote.contact?.fullName,
        phone: quote.contact?.phone,
        email: quote.contact?.email,
        address: quote.contact?.address,
        commune: quote.contact?.commune
      },
      quote: {
        title: quote.title,
        description: quote.description,
        amount: quote.amount,
        validityDays: quote.validityDays,
        paymentTerms: quote.paymentTerms,
        observations: quote.observations
      }
    };
    const buffer = await this.render(snapshot);
    const stored = this.storage.saveRawBuffer(buffer, {
      originalFileName: fileName,
      mimeType: 'application/pdf'
    });

    return this.prisma.quoteDocument.create({
      data: {
        professionalId,
        quoteId,
        version,
        fileName,
        storageProvider: stored.storageProvider,
        storageKey: stored.storageKey,
        publicUrl: stored.publicUrl,
        snapshot
      }
    });
  }

  async list(professionalId: string, quoteId: string) {
    const documents = await this.prisma.quoteDocument.findMany({
      where: { professionalId, quoteId },
      orderBy: { version: 'desc' }
    });
    return Promise.all(documents.map((document) => this.refreshPublicUrl(document)));
  }

  async latestOrGenerate(professionalId: string, quoteId: string, quoteUpdatedAt?: Date) {
    const latest = await this.prisma.quoteDocument.findFirst({
      where: { professionalId, quoteId },
      orderBy: { version: 'desc' }
    });
    if (
      latest
      && this.storage.hasFile(latest.storageKey)
      && (!quoteUpdatedAt || latest.generatedAt >= quoteUpdatedAt)
    ) {
      return this.refreshPublicUrl(latest);
    }
    return this.generate(professionalId, quoteId);
  }

  private async refreshPublicUrl<T extends { id: string; storageKey: string; publicUrl: string | null }>(document: T) {
    const publicUrl = this.storage.getPublicUrl(document.storageKey);
    if (document.publicUrl === publicUrl) return document;
    return this.prisma.quoteDocument.update({
      where: { id: document.id },
      data: { publicUrl }
    });
  }

  private render(snapshot: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 54, info: { Title: `Cotizacion ${snapshot.quote.title}` } });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const currency = snapshot.professional.currency || 'CLP';
      const amount = new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
      }).format(snapshot.quote.amount || 0);

      doc.fillColor('#0f172a').fontSize(24).font('Helvetica-Bold').text('COTIZACION');
      doc.moveDown(0.25);
      doc.fillColor('#64748b').fontSize(10).font('Helvetica')
        .text(`Version ${snapshot.version}  |  Emitida ${this.date(snapshot.generatedAt)}  |  Valida hasta ${this.date(snapshot.validUntil)}`);
      doc.moveDown(1.5);

      doc.fillColor('#059669').fontSize(15).font('Helvetica-Bold').text(snapshot.professional.displayName || 'Profesional');
      doc.fillColor('#334155').fontSize(10).font('Helvetica');
      [
        snapshot.professional.profession,
        snapshot.professional.phone,
        snapshot.professional.email
      ].filter(Boolean).forEach((line) => doc.text(line));

      doc.moveDown(1.5);
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('CLIENTE');
      doc.moveDown(0.35);
      doc.fillColor('#334155').fontSize(10).font('Helvetica');
      [
        snapshot.contact.fullName || 'Cliente por confirmar',
        snapshot.contact.phone,
        snapshot.contact.email,
        [snapshot.contact.address, snapshot.contact.commune].filter(Boolean).join(', ')
      ].filter(Boolean).forEach((line) => doc.text(line));

      doc.moveDown(1.5);
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('SERVICIO');
      doc.moveDown(0.5);
      doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(snapshot.quote.title || 'Servicio');
      if (snapshot.quote.description) {
        doc.moveDown(0.4);
        doc.fillColor('#475569').fontSize(10).font('Helvetica').text(snapshot.quote.description, { lineGap: 3 });
      }

      doc.moveDown(1.5);
      const y = doc.y;
      doc.roundedRect(54, y, 487, 66, 6).fill('#ecfdf5');
      doc.fillColor('#047857').fontSize(10).font('Helvetica-Bold').text('VALOR TOTAL', 72, y + 14);
      doc.fillColor('#064e3b').fontSize(22).font('Helvetica-Bold').text(amount, 72, y + 31);
      doc.y = y + 82;

      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('CONDICIONES');
      doc.moveDown(0.4);
      doc.fillColor('#475569').fontSize(10).font('Helvetica')
        .text(`Vigencia: ${snapshot.quote.validityDays} dias.`)
        .text(`Forma de pago: ${snapshot.quote.paymentTerms || 'A convenir.'}`);
      if (snapshot.quote.observations) {
        doc.moveDown(0.5).text(`Observaciones: ${snapshot.quote.observations}`, { lineGap: 3 });
      }

      doc.moveDown(2);
      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
        .text('Documento generado por Fluxio Light. Confirma disponibilidad y coordinacion antes de realizar el servicio.', { align: 'center' });
      doc.end();
    });
  }

  private date(value: string) {
    return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
  }

  private slug(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'servicio';
  }
}
