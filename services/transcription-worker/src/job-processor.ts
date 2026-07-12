import type { TranscriptionJobInput, TranscriptSegment } from './types';
import type { TranscriptionProvider } from './types';
import type { AudioStore } from './audio-store';

export interface ProcessorHandlers {
  saveSegments(lectureId: string, segments: TranscriptSegment[]): void;
  markLectureTranscribed(lectureId: string): void;
  queueAiAnalysis(lectureId: string, transcriptRef: string): void;
  log(message: string, meta?: Record<string, unknown>): void;
  onDeadLetter(job: TranscriptionJobInput, error: unknown): void;
}

export type ProcessOutcome =
  | { status: 'SUCCEEDED'; retryCount: number }
  | { status: 'DEAD_LETTERED'; retryCount: number; errorCode: string };

function maskError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(password|token|key|secret)=[^&\s]+/gi, '$1=***');
}

export class TranscriptionJobProcessor {
  private readonly processed = new Set<string>();

  constructor(
    private readonly provider: TranscriptionProvider,
    private readonly store: AudioStore,
    private readonly handlers: ProcessorHandlers,
    private readonly maxRetries = 3,
  ) {}

  isProcessed(jobId: string): boolean {
    return this.processed.has(jobId);
  }

  async process(job: TranscriptionJobInput): Promise<ProcessOutcome> {
    if (this.processed.has(job.jobId)) {
      this.handlers.log('idempotent skip: already processed', { jobId: job.jobId });
      return { status: 'SUCCEEDED', retryCount: 0 };
    }

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        await this.store.fetch(job);
        const result = await this.provider.transcribe(job);
        this.handlers.saveSegments(job.lectureId, result.segments);
        this.handlers.markLectureTranscribed(job.lectureId);
        this.handlers.queueAiAnalysis(job.lectureId, job.audioRef);
        this.processed.add(job.jobId);
        this.handlers.log('transcription succeeded', { jobId: job.jobId, language: result.language });
        return { status: 'SUCCEEDED', retryCount: attempt };
      } catch (error) {
        attempt += 1;
        const terminal = attempt > this.maxRetries;
        this.handlers.log('transcription attempt failed', {
          jobId: job.jobId,
          attempt,
          terminal,
          error: maskError(error),
        });
        if (terminal) {
          this.handlers.onDeadLetter(job, error);
          return { status: 'DEAD_LETTERED', retryCount: attempt, errorCode: 'TRANSCRIPTION_DEAD_LETTERED' };
        }
      }
    }
    return { status: 'DEAD_LETTERED', retryCount: attempt, errorCode: 'TRANSCRIPTION_DEAD_LETTERED' };
  }
}
