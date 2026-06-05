import { Module } from '@nestjs/common';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [EvidenceController],
  providers: [EvidenceService],
  exports: [EvidenceService]
})
export class EvidenceModule {}
