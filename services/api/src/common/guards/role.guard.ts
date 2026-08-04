import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

interface AuthenticatedUser {
  roles?: string[];
}

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true; // No role requirements

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user || !user.roles || user.roles.length === 0) {
      return false;
    }

    return requiredRoles.some(role => user.roles?.includes(role));
  }
}

export function Roles(...roles: Role[]) {
  return (_target: object, _key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('roles', roles, descriptor.value);
  };
}

export type Role = 'STUDENT' | 'PROFESSIONAL' | 'UNIVERSITY_ADMIN' | 'SUPPORT' | 'CONTENT_MODERATOR' | 'PLATFORM_ADMIN';