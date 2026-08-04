import { Injectable } from '@nestjs/common';
import type { AuditLog } from '@mindflow/types';
import { AuditRepository } from './repositories';

@Injectable()
export class AuditService {
  constructor(private readonly audits: AuditRepository) {}

  async record(input: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
    return this.audits.create({
      ...input,
      metadata: input.metadata ?? {},
    });
  }

  async list(): Promise<AuditLog[]> {
    return this.audits.list();
  }
}
