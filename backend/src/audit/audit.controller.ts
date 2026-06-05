import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditService } from './audit.service';

@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  list(@CurrentUser() user: any, @Query('take') take?: string) {
    return this.service.list(user.professionalId, Number(take || 100));
  }
}
