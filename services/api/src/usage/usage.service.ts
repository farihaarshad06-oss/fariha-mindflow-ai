import { Injectable } from '@nestjs/common';
import type { UsageEvent } from '@mindflow/types';
import { UsageService, type UsageTotals } from '../core/usage.service';

@Injectable()
export class AdminUsageService {
  constructor(private readonly usage: UsageService) {}

  async totals(): Promise<UsageTotals> {
    return this.usage.totals();
  }

  async events(): Promise<UsageEvent[]> {
    return this.usage.list();
  }
}
