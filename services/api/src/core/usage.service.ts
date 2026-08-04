import { Injectable } from '@nestjs/common';
import { UsageRepository } from './repositories';
import type { UsageEvent } from '@mindflow/types';

export interface UsageTotals {
  transcriptionMinutes: number;
  aiTokens: number;
  storageBytes: number;
}

@Injectable()
export class UsageService {
  constructor(private readonly repository: UsageRepository) {}

  async record(input: Omit<UsageEvent, 'id' | 'recordedAt'>): Promise<UsageEvent> {
    return this.repository.create(input);
  }

  async totals(): Promise<UsageTotals> {
    const events = await this.repository.list();
    return {
      transcriptionMinutes: events
        .filter((e) => e.kind === 'TRANSCRIPTION_MINUTES')
        .reduce((sum, e) => sum + e.amount, 0),
      aiTokens: events.filter((e) => e.kind === 'AI_TOKENS').reduce((sum, e) => sum + e.amount, 0),
      storageBytes: events
        .filter((e) => e.kind === 'STORAGE_BYTES')
        .reduce((sum, e) => sum + e.amount, 0),
    };
  }

  async list(): Promise<UsageEvent[]> {
    return this.repository.list();
  }
}
