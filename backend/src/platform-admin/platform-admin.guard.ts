import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const email = String(request.user?.email || '').trim().toLowerCase();
    const allowed = this.config
      .get<string>('PLATFORM_ADMIN_EMAILS', 'admin@fluxiolight.local')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    if (!email || !allowed.includes(email)) {
      throw new ForbiddenException('Solo administradores de plataforma pueden acceder a este recurso.');
    }

    return true;
  }
}
