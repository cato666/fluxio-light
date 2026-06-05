import { Body, Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EvidenceType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StorageService } from '../storage/storage.service';
import { EvidenceService } from './evidence.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';

@UseGuards(JwtAuthGuard)
@Controller('evidence')
export class EvidenceController {
  constructor(private evidence: EvidenceService, private storage: StorageService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.evidence.list(user.professionalId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File, @Body() body: CreateEvidenceDto) {
    const stored = this.storage.saveBuffer(file);
    const type = body.type || this.inferType(file.mimetype);
    return this.evidence.createFromStoredFile(user.professionalId, {
      ...body,
      ...stored,
      type,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size
    });
  }

  private inferType(mime?: string): EvidenceType {
    if (!mime) return 'OTHER';
    if (mime.startsWith('image/')) return 'IMAGE';
    if (mime.startsWith('video/')) return 'VIDEO';
    if (mime.startsWith('audio/')) return 'AUDIO';
    if (mime.includes('pdf') || mime.includes('document')) return 'DOCUMENT';
    return 'OTHER';
  }
}
