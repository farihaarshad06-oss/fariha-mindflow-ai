import type { User } from '@mindflow/types';
import type { StoredUser } from '../core/repositories';
import type { AuthResult } from './auth.dto';

export function toPublicUser(user: StoredUser): User {
  const { passwordHash: _passwordHash, ...rest } = user;
  void _passwordHash; // Prevent unused variable warning
  return { 
    ...rest, 
    roles: user.roles ?? ['STUDENT'],
    id: user.id,
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}