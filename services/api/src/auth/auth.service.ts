import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import type { User, Role } from '@mindflow/types';
import { UsersRepository } from '../core/repositories';
import { PasswordService } from '../core/password.service';
import { JwtService } from '../core/jwt.service';
import { AuditService } from '../core/audit.service';
import { toPublicUser, type AuthResult } from './auth.mapper';
import type { RegisterDto, LoginDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, requestId?: string): Promise<AuthResult> {
    if (!dto.email || !dto.password || !dto.fullName) {
      throw new BadRequestException('Email, password and full name are required.');
    }
    const existing = this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }
    const passwordHash = await this.passwords.hash(dto.password);
    const role: Role = (dto.role as Role) ?? 'STUDENT';
    const stored = this.users.create({
      email: dto.email,
      fullName: dto.fullName,
      roles: [role],
      passwordHash,
    });
    this.audit.record({
      actorId: stored.id,
      actorType: 'USER',
      action: 'USER_REGISTERED',
      resource: 'user',
      resourceId: stored.id,
      requestId,
    });
    return this.issueTokens(stored);
  }

  async login(dto: LoginDto, requestId?: string): Promise<AuthResult> {
    if (!dto.email || !dto.password) {
      throw new BadRequestException('Email and password are required.');
    }
    const stored = this.users.findByEmail(dto.email);
    if (!stored) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const valid = await this.passwords.verify(dto.password, stored.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (stored.status === 'DISABLED') {
      throw new UnauthorizedException('This account has been disabled.');
    }
    this.audit.record({
      actorId: stored.id,
      actorType: 'USER',
      action: 'USER_LOGGED_IN',
      resource: 'user',
      resourceId: stored.id,
      requestId,
    });
    return this.issueTokens(stored);
  }

  me(userId: string): User {
    const stored = this.users.findById(userId);
    if (!stored) throw new UnauthorizedException('User not found.');
    return toPublicUser(stored);
  }

  logout(_userId: string, requestId?: string): { success: true } {
    this.audit.record({
      actorId: _userId,
      actorType: 'USER',
      action: 'USER_LOGGED_OUT',
      resource: 'user',
      resourceId: _userId,
      requestId,
    });
    return { success: true };
  }

  private issueTokens(stored: Parameters<typeof toPublicUser>[0]): AuthResult {
    return {
      user: toPublicUser(stored),
      tokens: {
        accessToken: this.jwt.signAccess({ sub: stored.id, roles: stored.roles }),
        refreshToken: this.jwt.signRefresh({ sub: stored.id }),
      },
    };
  }
}
