import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { ConsentRecord, ConsentPurpose } from '@mindflow/types';
import { ConsentRecord as PrismaConsentRecord } from '@prisma/client';

@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async createMicrophoneConsent(userId: string, acknowledged: boolean): Promise<void> {
    await this.prisma.consentRecord.create({
      data: {
        userId,
        purpose: 'MICROPHONE_RECORDING',
        acknowledged: acknowledged,
        version: '1.0',
        createdAt: new Date(),
      },
    });
  }

  async createAIProcessingConsent(userId: string, acknowledged: boolean): Promise<void> {
    await this.prisma.consentRecord.create({
      data: {
        userId,
        purpose: 'AI_PROCESSING',
        acknowledged: acknowledged,
        version: '1.0',
        createdAt: new Date(),
      },
    });
  }

  async getConsentsByUser(userId: string): Promise<ConsentRecord[]> {
    return this.prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConsentById(id: string): Promise<ConsentRecord | null> {
    return this.prisma.consentRecord.findUnique({
      where: { id },
    });
  }

  async revokeConsent(consentId: string): Promise<void> {
    await this.prisma.consentRecord.update({
      where: { id },
      data: { acknowledged: false },
    });
  }
}

interface ConsentRecord {
  id: string;
  userId: string;
  purpose: string;
  acknowledged: boolean;
  version: string;
  createdAt: Date;
}

type ConsentPurpose = 'MICROPHONE_RECORDING' | 'AI_PROCESSING' | 'PRIVACY_SETTINGS';