import type { TranscriptionJobInput } from './types';
import type { TranscriptionProvider } from './types';

export interface AudioFetchResult {
  bytes: number;
}

export interface AudioStore {
  fetch(job: TranscriptionJobInput): Promise<AudioFetchResult>;
}

export class MockAudioStore implements AudioStore {
  async fetch(_job: TranscriptionJobInput): Promise<AudioFetchResult> {
    return { bytes: 1024 };
  }
}
