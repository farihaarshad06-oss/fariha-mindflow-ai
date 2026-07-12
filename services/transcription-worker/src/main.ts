import { randomUUID } from 'node:crypto';
import { MockTranscriptionProvider } from './providers/mock-transcription.provider';
import { MockAudioStore } from './audio-store';
import { TranscriptionJobProcessor, type ProcessorHandlers } from './job-processor';
import type { TranscriptSegment } from './types';

const handlers: ProcessorHandlers = {
  saveSegments(lectureId, segments: TranscriptSegment[]) {
    // eslint-disable-next-line no-console
    console.log(`[transcription] saved ${segments.length} segments for lecture ${lectureId}`);
  },
  markLectureTranscribed(lectureId) {
    console.log(`[transcription] lecture ${lectureId} marked TRANSCRIBED`);
  },
  queueAiAnalysis(lectureId, transcriptRef) {
    console.log(`[transcription] queued AI analysis for ${lectureId} (${transcriptRef})`);
  },
  log(message, meta) {
    console.log(`[transcription] ${message}`, meta ?? '');
  },
  onDeadLetter(job, error) {
    console.error(`[transcription] dead-letter for job ${job.jobId}`, error instanceof Error ? error.message : error);
  },
};

async function main(): Promise<void> {
  const processor = new TranscriptionJobProcessor(
    new MockTranscriptionProvider(),
    new MockAudioStore(),
    handlers,
  );
  const job = {
    jobId: process.argv[2] ?? randomUUID(),
    lectureId: process.argv[3] ?? randomUUID(),
    audioRef: process.argv[4] ?? 'sample-audio.webm',
    ownerId: 'demo-student',
  };
  const outcome = await processor.process(job);
  console.log('[transcription] outcome:', outcome);
  process.exit(outcome.status === 'SUCCEEDED' ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
