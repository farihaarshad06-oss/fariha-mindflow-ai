import type { User } from '@mindflow/types';
import type { StoredUser } from '../core/repositories';

export function toPublicUser(user: StoredUser): User {
  const { passwordHash: _passwordHash, ...rest } = user;
  void _passwordHash;
  return { ...rest, roles: user.roles ?? ['STUDENT'] };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}
