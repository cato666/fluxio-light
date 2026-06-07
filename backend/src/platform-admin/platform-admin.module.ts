import { Module } from '@nestjs/common';
import { KapsoModule } from '../kapso/kapso.module';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';

@Module({
  imports: [KapsoModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminGuard, PlatformAdminService]
})
export class PlatformAdminModule {}
