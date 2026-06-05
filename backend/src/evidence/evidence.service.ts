import { Injectable } from '@nestjs/common';
import { EvidenceCategory, EvidenceType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class EvidenceService {
  constructor(private prisma: PrismaService) {}

  list(professionalId: string) {
    return this.prisma.evidenceFile.findMany({
      where: { professionalId },
      orderBy: { createdAt: 'desc' }
    });
  }

  createFromStoredFile(professionalId: string, data: {
    type: EvidenceType;
    category?: EvidenceCategory;
    storageProvider: string;
    storageKey: string;
    publicUrl?: string;
    originalFileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    caption?: string;
    source?: string;
    contactId?: string;
    leadId?: string;
    appointmentId?: string;
    attendanceId?: string;
    conversationId?: string;
    messageId?: string;
  }) {
    return this.prisma.evidenceFile.create({
      data: {
        professionalId,
        type: data.type,
        category: data.category || 'GENERAL',
        storageProvider: data.storageProvider,
        storageKey: data.storageKey,
        publicUrl: data.publicUrl,
        originalFileName: data.originalFileName,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        caption: data.caption,
        source: data.source || 'web_upload',
        contactId: data.contactId,
        leadId: data.leadId,
        appointmentId: data.appointmentId,
        attendanceId: data.attendanceId,
        conversationId: data.conversationId,
        messageId: data.messageId
      }
    });
  }
}
