import { Injectable, Logger } from '@nestjs/common';
import { EvidenceCategory, EvidenceType } from '@prisma/client';
import { StorageService } from '../storage/storage.service';

export interface ExtractedKapsoMedia {
  type: EvidenceType;
  category: EvidenceCategory;
  mediaUrl?: string;
  originalFileName?: string;
  mimeType?: string;
  caption?: string;
}

@Injectable()
export class WhatsappMediaService {
  private readonly logger = new Logger(WhatsappMediaService.name);

  constructor(private readonly storage: StorageService) {}

  extract(message: any, messageType: string): ExtractedKapsoMedia {
    const type = this.mapType(messageType);
    const mediaData = message?.kapso?.media_data || message?.[messageType] || {};
    const caption = message?.kapso?.message_type_data?.caption || mediaData?.caption || message?.caption;

    return {
      type,
      category: this.inferCategory(caption),
      mediaUrl: message?.kapso?.media_url || mediaData?.url || mediaData?.link || mediaData?.href,
      originalFileName: mediaData?.filename || message?.document?.filename || `${message?.id || 'whatsapp-media'}${this.extensionFromMime(mediaData?.content_type || mediaData?.mime_type)}`,
      mimeType: mediaData?.content_type || mediaData?.mime_type || message?.mime_type,
      caption
    };
  }

  async store(media: ExtractedKapsoMedia) {
    if (!media.mediaUrl) return null;

    try {
      const res = await fetch(media.mediaUrl);
      if (!res.ok) {
        throw new Error(`Media download failed: ${res.status}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const mimeType = media.mimeType || res.headers.get('content-type') || undefined;
      return this.storage.saveRawBuffer(Buffer.from(arrayBuffer), {
        originalFileName: media.originalFileName,
        mimeType
      });
    } catch (error) {
      this.logger.warn(`No se pudo descargar media Kapso, se conserva URL temporal: ${error}`);
      return null;
    }
  }

  private mapType(messageType: string): EvidenceType {
    if (messageType === 'image') return 'IMAGE';
    if (messageType === 'video') return 'VIDEO';
    if (messageType === 'audio') return 'AUDIO';
    if (messageType === 'document') return 'DOCUMENT';
    return 'OTHER';
  }

  private inferCategory(caption?: string): EvidenceCategory {
    const text = (caption || '').toLowerCase();
    if (this.hasAny(text, ['antes', 'before'])) return 'BEFORE';
    if (this.hasAny(text, ['despues', 'después', 'after'])) return 'AFTER';
    if (this.hasAny(text, ['pago', 'comprobante', 'payment'])) return 'PAYMENT_PROOF';
    if (this.hasAny(text, ['daño', 'dano', 'damage'])) return 'DAMAGE';
    if (this.hasAny(text, ['repuesto', 'spare', 'pieza'])) return 'SPARE_PART';
    if (this.hasAny(text, ['receta', 'prescription'])) return 'PRESCRIPTION';
    return 'GENERAL';
  }

  private hasAny(text: string, tokens: string[]) {
    return tokens.some((token) => text.includes(token));
  }

  private extensionFromMime(mime?: string) {
    if (!mime) return '';
    if (mime === 'image/jpeg') return '.jpg';
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    if (mime === 'video/mp4') return '.mp4';
    if (mime === 'audio/mpeg') return '.mp3';
    if (mime === 'audio/ogg') return '.ogg';
    if (mime === 'application/pdf') return '.pdf';
    return '';
  }
}
