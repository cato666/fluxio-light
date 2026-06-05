import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProfessionalsService } from './professionals.service';

@UseGuards(JwtAuthGuard)
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly service: ProfessionalsService) {}

  @Get('me')
  me(@CurrentUser() user: any) {
    return this.service.get(user.professionalId);
  }

  @Get('demo-mode')
  demoMode(@CurrentUser() user: any) {
    return this.service.demoMode(user.professionalId);
  }

  @Get('real-start')
  realStart(@CurrentUser() user: any) {
    return this.service.realStart(user.professionalId);
  }

  @Patch('me')
  update(@CurrentUser() user: any, @Body() body: any) {
    return this.service.update(user.professionalId, body);
  }
}
