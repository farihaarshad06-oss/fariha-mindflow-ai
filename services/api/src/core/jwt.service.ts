import { Injectable } from '@nestjs/common';
import { JwtService as OriginalJwtService } from './jwt.service';
import { Request } from 'express';

@Injectable()
export class JwtService {
  private readonly originalJwtService: OriginalJwtService;

  constructor() {
    this.originalJwtService = new OriginalJwtService();
  }

  signAccess(payload: Omit<AccessTokenPayload, 'type'>): string {
    return this.originalJwtService.signAccess(payload);
  }

  signRefresh(payload: Omit<RefreshTokenPayload, 'type'>): string {
    return this.originalJwtService.signRefresh(payload);
  }

  verifyAccess(token: string): AccessTokenPayload {
    return this.originalJwtService.verifyAccess(token);
  }

  verifyRefresh(token: string): RefreshTokenPayload {
    return this.originalJwtService.verifyRefresh(token);
  }

  async verifyToken(token: string, requestId?: string): Promise<boolean> {
    try {
      const payload = this.verifyAccess(token);
      const isExpired = this.isTokenExpired(token);
      
      if (isExpired) {
        throw new Error('token expired');
      }
      
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = this.verifyAccess(token);
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}