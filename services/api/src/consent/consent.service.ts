import { Injectable } from '@nestjs/common';
import type { ConsentRecord } from '@mindflow/types';
import { ConsentRepository } from '../core/repositories';

@Injectable()
export class ConsentService {
  constructor(private readonly consents: ConsentRepository) {}

  async createMicrophoneConsent(userId: string, acknowledged: boolean): Promise<void> {
    await this.consents.create({
      userId,
      purpose: 'MICROPHONE_RECORDING',
      acknowledged,
      version: '1.0',
    });
  }

  async createAIProcessingConsent(userId: string, acknowledged: boolean): Promise<void> {
    await this.consents.create({
      userId,
      purpose: 'AI_PROCESSING',
      acknowledged,
      version: '1.0',
    });
  }

  async getConsentsByUser(userId: string): Promise<ConsentRecord[]> {
    return this.consents.listByUser(userId);
  }
}
