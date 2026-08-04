import { Injectable } from '@nestjs/common';
import { env } from './core/env';

@Injectable()
export class FeatureFlagService {
  private readonly flags = new Map<string, boolean>();

  constructor() {
    this.flags.set('real-ai-provider', env.FEATURE_REAL_AI_PROVIDER);
    this.flags.set('real-transcription', env.FEATURE_REAL_TRANSCRIPTION);
    this.flags.set('mind-maps', env.FEATURE_MIND_MAPS);
    this.flags.set('teacher-portal', env.FEATURE_TEACHER_PORTAL);
    this.flags.set('push-notifications', env.FEATURE_PUSH_NOTIFICATIONS);
  }

  isEnabled(flagName: string): boolean {
    return this.flags.get(flagName) ?? false;
  }

  toggleFlag(flagName: string, enabled: boolean): void {
    this.flags.set(flagName, enabled);
  }

  getAllFlags(): Record<string, boolean> {
    return Object.fromEntries(this.flags.entries());
  }
}
