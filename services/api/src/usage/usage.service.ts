import { Injectable } from '@nestjs/common';
import type { UsageEvent } from '@mindflow/types';
import { UsageService, type UsageTotals } from '../core/usage.service';

@Injectable()
export class AdminUsageService {
  constructor(private readonly usage: UsageService) {}

  totals(): UsageTotals {
    return this.usage.totals();
  }

  events(): UsageEvent[] {
    return this.usage.list();
  }
}
