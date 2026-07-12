import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AccessTokenPayload } from '../core/jwt.service';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

export function Public(): MethodDecorator & ClassDecorator {
  return SetMetadata(IS_PUBLIC_KEY, true);
}

export function Roles(...roles: string[]): MethodDecorator & ClassDecorator {
  return SetMetadata(ROLES_KEY, roles);
}

export interface AuthenticatedUser {
  userId: string;
  roles: string[];
  email: string;
}

export function extractUser(context: ExecutionContext): AuthenticatedUser | null {
  const request = context.switchToHttp().getRequest();
  const payload = request.user as AccessTokenPayload | undefined;
  if (!payload || payload.type !== 'access') return null;
  return { userId: payload.sub, roles: payload.roles ?? [], email: '' };
}

export const CurrentUser = createParamDecorator<unknown, ExecutionContext, AuthenticatedUser | null>(
  (_data: unknown, context: ExecutionContext) => extractUser(context),
);
