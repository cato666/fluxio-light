import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';

@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('platform-admin')
export class PlatformAdminController {
  constructor(private readonly service: PlatformAdminService) {}

  @Get('overview')
  overview() {
    return this.service.overview();
  }

  @Get('invitations')
  invitations() {
    return this.service.invitations();
  }

  @Post('invitations')
  createInvitation(@Body() body: any) {
    return this.service.createInvitation(body);
  }

  @Patch('invitations/:id/cancel')
  cancelInvitation(@Param('id') id: string) {
    return this.service.cancelInvitation(id);
  }

  @Get('professionals')
  professionals(@Query('q') query?: string) {
    return this.service.professionals(query || '');
  }

  @Get('professionals/:id')
  professionalDetail(@Param('id') id: string) {
    return this.service.professionalDetail(id);
  }

  @Post('professionals/:id/demo-data')
  prepareDemoData(@Param('id') id: string) {
    return this.service.prepareDemoData(id);
  }

  @Post('professionals/:id/demo-data/reset')
  resetDemoData(@Param('id') id: string) {
    return this.service.resetDemoData(id);
  }

  @Get('professionals/:id/demo-health')
  demoHealth(@Param('id') id: string) {
    return this.service.demoHealth(id);
  }

  @Get('professionals/:id/real-pilot-health')
  realPilotHealth(@Param('id') id: string) {
    return this.service.realPilotHealth(id);
  }

  @Patch('professionals/:id/phones')
  updateProfessionalPhones(@Param('id') id: string, @Body() body: any) {
    return this.service.updateProfessionalPhones(id, body);
  }

  @Patch('professionals/:id/admin-notes')
  updateAdminNotes(@Param('id') id: string, @Body() body: any) {
    return this.service.updateAdminNotes(id, body);
  }

  @Patch('users/:id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: any) {
    return this.service.updateAccountStatus(id, status);
  }

  @Get('routing-validation')
  routingValidation() {
    return this.service.validateRouting();
  }

  @Get('outbound-messages')
  outboundMessages(@Query('status') status?: string, @Query('take') take?: string) {
    return this.service.outboundMessages(status || '', Number(take || 50));
  }

  @Get('whatsapp-health')
  whatsappHealth() {
    return this.service.whatsappHealth();
  }

  @Post('outbound-messages/:id/retry')
  retryOutboundMessage(@Param('id') id: string) {
    return this.service.retryOutboundMessage(id);
  }

  @Get('data-reassignment/preview')
  previewPhoneReassignment(@Query('phone') phone?: string) {
    return this.service.previewPhoneReassignment(phone || '');
  }

  @Post('data-reassignment/execute')
  executePhoneReassignment(@Body() body: any) {
    return this.service.executePhoneReassignment(body);
  }
}
