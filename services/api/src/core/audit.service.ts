import { Injectable } from '@nestjs/common';
import { AuditRepository } from './repositories';
import type { AuditLog } from '@mindflow/types';

@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  record(input: Omit<AuditLog, 'id' | 'createdAt'>): AuditLog {
    return this.repository.create(input);
  }

  list(): AuditLog[] {
    return this.repository.list().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
}
