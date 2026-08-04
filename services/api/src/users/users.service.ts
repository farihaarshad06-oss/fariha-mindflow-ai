import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@mindflow/types';
import { UsersRepository } from '../core/repositories';
import { toPublicUser } from '../auth/auth.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  async list(): Promise<User[]> {
    const users = await this.users.list();
    return users.map(toPublicUser);
  }

  async getById(id: string): Promise<User> {
    const stored = await this.users.findById(id);
    if (!stored) throw new NotFoundException('User not found.');
    return toPublicUser(stored);
  }

  async disable(id: string): Promise<User> {
    const stored = await this.users.findById(id);
    if (!stored) throw new NotFoundException('User not found.');
    const updated = await this.users.save({ ...stored, status: 'DISABLED' });
    return toPublicUser(updated);
  }
}
