import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';

@Injectable()
export class StorageService {
  constructor(private config: ConfigService) {}

  saveBuffer(file: Express.Multer.File) {
    return this.saveRawBuffer(file.buffer, {
      originalFileName: file.originalname,
      mimeType: file.mimetype
    });
  }

  saveRawBuffer(buffer: Buffer, options: { originalFileName?: string; mimeType?: string }) {
    const root = this.config.get<string>('LOCAL_STORAGE_PATH') || './uploads';
    mkdirSync(root, { recursive: true });
    const extension = extname(options.originalFileName || '') || this.extensionFromMime(options.mimeType);
    const key = `${randomUUID()}${extension}`;
    const fullPath = join(root, key);
    writeFileSync(fullPath, buffer);

    const publicBase = this.config.get<string>('PUBLIC_STORAGE_BASE_URL') || 'http://localhost:3000/uploads';
    return {
      storageProvider: 'local',
      storageKey: key,
      publicUrl: `${publicBase}/${key}`
    };
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
