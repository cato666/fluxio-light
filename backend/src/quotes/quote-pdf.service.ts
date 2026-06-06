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
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        info: {
          Title: `Cotizacion ${snapshot.quote.title}`,
          Author: snapshot.professional.displayName || 'Fluxio Light',
          Subject: `Cotizacion para ${snapshot.contact.fullName || 'cliente'}`
        }
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 48;
      const contentWidth = pageWidth - margin * 2;
      const colors = {
        ink: '#17211d',
        body: '#42504a',
        muted: '#718079',
        line: '#dce5e0',
        soft: '#f3f7f5',
        accent: '#11875d',
        accentDark: '#075c40',
        accentSoft: '#e7f5ef',
        white: '#ffffff'
      };
      const currency = snapshot.professional.currency || 'CLP';
      const amount = new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
      }).format(snapshot.quote.amount || 0);

      doc.rect(0, 0, pageWidth, 9).fill(colors.accent);

      doc.roundedRect(margin, 36, 34, 34, 6).fill(colors.accent);
      doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(14).text('FL', margin, 47, {
        width: 34,
        align: 'center'
      });
      doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(13).text('FLUXIO LIGHT', 92, 42);
      doc.fillColor(colors.muted).font('Helvetica').fontSize(8.5).text('GESTION PROFESIONAL', 92, 58);

      doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(24).text('COTIZACION', 344, 38, {
        width: 203,
        align: 'right'
      });
      doc.fillColor(colors.muted).font('Helvetica').fontSize(8.5).text(
        `N. ${this.quoteNumber(snapshot.quoteId, snapshot.version)}`,
        344,
        64,
        { width: 203, align: 'right' }
      );

      doc.moveTo(margin, 91).lineTo(pageWidth - margin, 91).lineWidth(1).stroke(colors.line);

      const professionalY = 116;
      doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(8).text('EMITIDO POR', margin, professionalY);
      doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(13).text(
        snapshot.professional.displayName || 'Profesional',
        margin,
        professionalY + 17,
        { width: 270 }
      );
      doc.fillColor(colors.body).font('Helvetica').fontSize(9.5);
      const professionalLines = [
        snapshot.professional.profession,
        snapshot.professional.phone,
        snapshot.professional.email
      ].filter(Boolean);
      professionalLines.forEach((line, index) => {
        doc.text(line, margin, professionalY + 39 + index * 15, { width: 270 });
      });

      doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(8).text('FECHAS', 365, professionalY);
      this.metaRow(doc, 'Emision', this.date(snapshot.generatedAt), 365, professionalY + 18, 182, colors);
      this.metaRow(doc, 'Valida hasta', this.date(snapshot.validUntil), 365, professionalY + 39, 182, colors);
      this.metaRow(doc, 'Vigencia', `${snapshot.quote.validityDays} dias`, 365, professionalY + 60, 182, colors);

      const clientY = 219;
      doc.roundedRect(margin, clientY, contentWidth, 82, 6).fill(colors.soft);
      doc.fillColor(colors.accent).font('Helvetica-Bold').fontSize(8).text('PREPARADA PARA', margin + 18, clientY + 15);
      doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(13).text(
        snapshot.contact.fullName || 'Cliente por confirmar',
        margin + 18,
        clientY + 34,
        { width: 245 }
      );
      const clientDetail = [
        snapshot.contact.phone,
        snapshot.contact.email
      ].filter(Boolean).join('  |  ');
      if (clientDetail) {
        doc.fillColor(colors.body).font('Helvetica').fontSize(9).text(clientDetail, margin + 18, clientY + 55, {
          width: 245
        });
      }
      const address = [snapshot.contact.address, snapshot.contact.commune].filter(Boolean).join(', ');
      if (address) {
        doc.fillColor(colors.muted).font('Helvetica').fontSize(9).text(address, 336, clientY + 35, {
          width: 193,
          align: 'right'
        });
      }

      const tableY = 329;
      doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(12).text('Detalle de la propuesta', margin, tableY);
      doc.roundedRect(margin, tableY + 25, contentWidth, 32, 4).fill(colors.accentDark);
      doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(8.5);
      doc.text('SERVICIO', margin + 15, tableY + 37, { width: 330 });
      doc.text('VALOR', 399, tableY + 37, { width: 130, align: 'right' });

      const description = snapshot.quote.description || 'Servicio profesional segun coordinacion con el cliente.';
      const descriptionHeight = Math.max(70, doc.heightOfString(description, {
        width: 325,
        lineGap: 3
      }) + 55);
      const rowHeight = Math.min(descriptionHeight, 124);
      const rowY = tableY + 57;
      doc.rect(margin, rowY, contentWidth, rowHeight).fill(colors.white).stroke(colors.line);
      doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(11).text(
        snapshot.quote.title || 'Servicio profesional',
        margin + 15,
        rowY + 14,
        { width: 325 }
      );
      doc.fillColor(colors.body).font('Helvetica').fontSize(9.3).text(
        description,
        margin + 15,
        rowY + 34,
        { width: 325, height: rowHeight - 42, lineGap: 3, ellipsis: true }
      );
      doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(13).text(
        amount,
        399,
        rowY + 17,
        { width: 130, align: 'right' }
      );

      const totalY = rowY + rowHeight + 18;
      doc.roundedRect(331, totalY, 216, 61, 6).fill(colors.accentSoft);
      doc.fillColor(colors.accentDark).font('Helvetica-Bold').fontSize(8.5).text('TOTAL COTIZADO', 349, totalY + 12);
      doc.fillColor(colors.accentDark).font('Helvetica-Bold').fontSize(21).text(amount, 349, totalY + 29, {
        width: 180,
        align: 'right'
      });

      const conditionsY = totalY + 88;
      doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(11).text('Condiciones comerciales', margin, conditionsY);
      doc.moveTo(margin, conditionsY + 21).lineTo(pageWidth - margin, conditionsY + 21).stroke(colors.line);
      this.conditionRow(
        doc,
        'Forma de pago',
        snapshot.quote.paymentTerms || 'A convenir con el profesional',
        margin,
        conditionsY + 36,
        contentWidth,
        colors
      );
      this.conditionRow(
        doc,
        'Vigencia',
        `${snapshot.quote.validityDays} dias desde la fecha de emision`,
        margin,
        conditionsY + 62,
        contentWidth,
        colors
      );

      if (snapshot.quote.observations) {
        doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(8).text('OBSERVACIONES', margin, conditionsY + 96);
        doc.fillColor(colors.body).font('Helvetica').fontSize(9.2).text(
          snapshot.quote.observations,
          margin,
          conditionsY + 111,
          { width: contentWidth, height: 52, lineGap: 3, ellipsis: true }
        );
      }

      doc.roundedRect(margin, pageHeight - 128, contentWidth, 50, 6).fill(colors.soft);
      doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(9.5).text(
        'Para aceptar esta cotizacion, responde al mensaje de WhatsApp o contacta directamente al profesional.',
        margin + 16,
        pageHeight - 111,
        { width: contentWidth - 32, align: 'center' }
      );

      doc.moveTo(margin, pageHeight - 52).lineTo(pageWidth - margin, pageHeight - 52).stroke(colors.line);
      doc.fillColor(colors.muted).font('Helvetica').fontSize(7.8).text(
        `Generado por Fluxio Light  |  ${this.date(snapshot.generatedAt)}  |  Documento v${snapshot.version}`,
        margin,
        pageHeight - 37,
        { width: contentWidth, align: 'center' }
      );
      doc.end();
    });
  }

  private metaRow(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number, colors: any) {
    doc.fillColor(colors.muted).font('Helvetica').fontSize(8.5).text(label, x, y, { width: 76 });
    doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(8.5).text(value, x + 76, y, {
      width: width - 76,
      align: 'right'
    });
  }

  private conditionRow(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
    colors: any
  ) {
    doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(8.5).text(label.toUpperCase(), x, y, { width: 115 });
    doc.fillColor(colors.body).font('Helvetica').fontSize(9.5).text(value, x + 125, y - 1, {
      width: width - 125
    });
  }

  private quoteNumber(quoteId: string, version: number) {
    return `${String(quoteId || '').replace(/-/g, '').slice(0, 8).toUpperCase()}-${String(version).padStart(2, '0')}`;
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
