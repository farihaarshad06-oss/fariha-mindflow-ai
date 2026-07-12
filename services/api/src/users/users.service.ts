import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@mindflow/types';
import { UsersRepository } from '../core/repositories';
import { toPublicUser } from '../auth/auth.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  list(): User[] {
    return this.users.list().map(toPublicUser);
  }

  getById(id: string): User {
    const stored = this.users.findById(id);
    if (!stored) throw new NotFoundException('User not found.');
    return toPublicUser(stored);
  }

  disable(id: string): User {
    const stored = this.users.findById(id);
    if (!stored) throw new NotFoundException('User not found.');
    stored.status = 'DISABLED';
    this.users.save(stored);
    return toPublicUser(stored);
  }
}
