import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { MessageTemplatesService } from '../message-templates/message-templates.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private templates: MessageTemplatesService,
    private config: ConfigService
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Ya existe una cuenta con ese email.');

    const invitation = dto.invitationToken
      ? await this.prisma.professionalInvitation.findUnique({ where: { token: dto.invitationToken } })
      : null;
    if (dto.invitationToken) {
      if (!invitation) throw new BadRequestException('Invitacion invalida.');
      if (invitation.status !== 'PENDING') throw new BadRequestException('Invitacion no disponible.');
      if (invitation.expiresAt < new Date()) {
        await this.prisma.professionalInvitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' }
        });
        throw new BadRequestException('Invitacion expirada.');
      }
      if (invitation.email.trim().toLowerCase() !== email) {
        throw new BadRequestException('El email no coincide con la invitacion.');
      }
    }

    const displayName = (dto.displayName || invitation?.displayName || '').trim();
    const phone = dto.phone?.trim() || invitation?.phone || undefined;
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name: displayName,
          passwordHash,
          accountStatus: 'PENDING_APPROVAL',
          professional: {
            create: {
              displayName,
              profession: dto.profession?.trim() || invitation?.profession || undefined,
              phone,
              assistantAllowedPhones: phone,
              email
            }
          }
        },
        include: { professional: true }
      });

      if (invitation) {
        await tx.professionalInvitation.update({
          where: { id: invitation.id },
          data: {
            status: 'ACCEPTED',
            acceptedAt: new Date(),
            acceptedUserId: created.id
          }
        });
        await tx.auditLog.create({
          data: {
            action: 'PROFESSIONAL_INVITATION_ACCEPTED',
            entity: 'ProfessionalInvitation',
            entityId: invitation.id,
            metadata: {
              email,
              userId: created.id,
              professionalId: created.professional?.id || null
            }
          }
        });
      }

      return created;
    });

    if (user.professional?.id) {
      await this.templates.ensureDefaults(user.professional.id);
    }

    return {
      ok: true,
      status: user.accountStatus,
      message: 'Tu cuenta fue creada y quedo pendiente de aprobacion por Fluxio.'
    };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { professional: true }
    });

    if (!user) throw new UnauthorizedException('Credenciales invalidas');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales invalidas');
    if (user.accountStatus !== 'ACTIVE') {
      throw new UnauthorizedException(
        user.accountStatus === 'SUSPENDED'
          ? 'Tu cuenta esta suspendida. Contacta a Fluxio.'
          : 'Tu cuenta esta pendiente de aprobacion por Fluxio.'
      );
    }

    const payload = {
      sub: user.id,
      email: user.email,
      professionalId: user.professional?.id
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: this.serializeUser(user)
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { professional: true }
    });
    if (!user) throw new UnauthorizedException('Credenciales invalidas');

    return this.serializeUser(user);
  }

  private serializeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      accountStatus: user.accountStatus,
      professionalId: user.professional?.id,
      professional: user.professional,
      isPlatformAdmin: this.isPlatformAdmin(user.email)
    };
  }

  private isPlatformAdmin(email: string) {
    const allowed = this.config
      .get<string>('PLATFORM_ADMIN_EMAILS', 'admin@fluxiolight.local')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    return allowed.includes(String(email || '').trim().toLowerCase());
  }
}
