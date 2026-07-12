import type { TranscriptionProvider, TranscriptionJobInput, TranscriptionResult } from '../types';

/**
 * Azure AI Speech adapter skeleton. The real implementation calls the Azure
 * Speech SDK with AZURE_SPEECH_KEY / AZURE_SPEECH_REGION. It is intentionally
 * not wired to live credentials in Phase 1.
 */
export class AzureSpeechTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'azure-speech';

  constructor(
    private readonly key: string | undefined,
    private readonly region: string | undefined,
  ) {}

  async transcribe(_job: TranscriptionJobInput): Promise<TranscriptionResult> {
    if (!this.key || !this.region) {
      throw new Error('Azure Speech is not configured (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION).');
    }
    throw new Error('AzureSpeechTranscriptionProvider is not implemented in Phase 1.');
  }
}

/**
 * Optional OpenAI transcription adapter interface. Kept as an interface so a
 * future implementation can be dropped in without changing the processor.
 */
export interface OpenAiTranscriptionProvider extends TranscriptionProvider {
  readonly name: 'openai';
}
