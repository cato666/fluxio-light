import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, isAbsolute, join, resolve } from 'path';

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
    const root = this.getRootPath();
    mkdirSync(root, { recursive: true });
    const extension = extname(options.originalFileName || '') || this.extensionFromMime(options.mimeType);
    const key = `${randomUUID()}${extension}`;
    const fullPath = join(root, key);
    writeFileSync(fullPath, buffer);

    return {
      storageProvider: 'local',
      storageKey: key,
      publicUrl: this.getPublicUrl(key)
    };
  }

  getRootPath() {
    const configured = this.config.get<string>('LOCAL_STORAGE_PATH') || './uploads';
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }

  getPublicUrl(storageKey: string) {
    const configuredBase = this.normalizeBase(this.config.get<string>('PUBLIC_STORAGE_BASE_URL'));
    const appUrl = this.normalizeBase(this.config.get<string>('APP_URL'));
    const publicBase = configuredBase || (appUrl ? `${appUrl}/uploads` : 'http://localhost:3000/uploads');
    return `${publicBase}/${storageKey}`;
  }

  hasFile(storageKey: string) {
    return existsSync(join(this.getRootPath(), storageKey));
  }

  private normalizeBase(value?: string) {
    return String(value || '').trim().replace(/\/+$/, '');
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
