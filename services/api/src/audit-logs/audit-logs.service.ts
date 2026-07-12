import { Injectable } from '@nestjs/common';
import type { AuditLog } from '@mindflow/types';
import { AuditService } from '../core/audit.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly audit: AuditService) {}

  list(): AuditLog[] {
    return this.audit.list();
  }
}
