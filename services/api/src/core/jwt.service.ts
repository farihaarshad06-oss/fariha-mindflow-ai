import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { env } from './env';

export interface AccessTokenPayload {
  sub: string;
  roles: string[];
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function decodeBase64Url(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

@Injectable()
export class JwtService {
  signAccess(payload: Omit<AccessTokenPayload, 'type'>): string {
    return this.sign({ ...payload, type: 'access' }, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES_IN);
  }

  signRefresh(payload: Omit<RefreshTokenPayload, 'type'>): string {
    return this.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRES_IN);
  }

  private sign(payload: Record<string, unknown>, secret: string, expiresIn: string): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const exp = issuedAt + this.parseExpiresIn(expiresIn);
    const body = { ...payload, iat: issuedAt, exp };
    const header = { alg: 'HS256', typ: 'JWT' };
    const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(body))}`;
    const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');
    return `${signingInput}.${signature}`;
  }

  verifyAccess(token: string): AccessTokenPayload {
    return this.verify(token, env.JWT_ACCESS_SECRET) as unknown as AccessTokenPayload;
  }

  verifyRefresh(token: string): RefreshTokenPayload {
    return this.verify(token, env.JWT_REFRESH_SECRET) as unknown as RefreshTokenPayload;
  }

  private verify(token: string, secret: string): Record<string, unknown> {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('invalid token');
    const [header, body, signature] = parts;
    const signingInput = `${header}.${body}`;
    const expected = createHmac('sha256', secret).update(signingInput).digest('base64url');
    const a = decodeBase64Url(signature);
    const b = decodeBase64Url(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('invalid signature');
    }
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      exp: number;
    } & Record<string, unknown>;
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      throw new Error('token expired');
    }
    return decoded;
  }

  private parseExpiresIn(value: string): number {
    const match = /^(\d+)\s*(s|m|h|d)$/.exec(value.trim());
    if (!match) return 900;
    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return amount * multipliers[unit];
  }
}
