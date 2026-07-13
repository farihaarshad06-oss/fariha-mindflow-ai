import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FeatureFlagService {
  private readonly flags: Map<string, boolean> = new Map();

  constructor(private readonly config: ConfigService) {
    this.loadFlagsFromConfig();
  }

  private loadFlagsFromConfig(): void {
    // In a real implementation, these would come from environment variables or a database
    // For now, we'll use configuration from the ConfigService
    const flags = {
      'real-ai-provider': this.config.get<boolean>('FEATURE_FLAG_REAL_AI', false),
      'real-transcription': this.config.get<boolean>('FEATURE_FLAG_REAL_TRANSCRIPTION', false),
      'mind-maps': this.config.get<boolean>('FEATURE_FLAG_MIND_MAPS', false),
      'teacher-portal': this.config.get<boolean>('FEATURE_FLAG_TEACHER_PORTAL', false),
      'push-notifications': this.config.get<boolean>('FEATURE_FLAG_PUSH_NOTIFICATIONS', false),
      'production-billing': this.config.get<boolean>('FEATURE_FLAG_PRODUCTION_BILLING', false),
      'image-understanding': this.config.get<boolean>('FEATURE_FLAG_IMAGE_UNDERSTANDING', false),
      'voice-conversation': this.config.get<boolean>('FEATURE_FLAG_VOICE_CONVERSATION', false),
    };

    flags.forEach((value, key) => {
      this.flags.set(key, value);
    });
  }

  isEnabled(flagName: string): boolean {
    return this.flags.get(flagName) ?? false;
  }

  toggleFlag(flagName: string, enabled: boolean): void {
    this.flags.set(flagName, enabled);
  }

  getAllFlags(): Map<string, boolean> {
    return this.flags;
  }