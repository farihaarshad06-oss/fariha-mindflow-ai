import { MockTranscriptionProvider } from './providers/mock-transcription.provider';
import { MockAudioStore } from './audio-store';
import { TranscriptionJobProcessor, type ProcessorHandlers } from './job-processor';
import type { TranscriptSegment } from './types';

const job = {
  jobId: 'job-1',
  lectureId: 'lecture-1',
  audioRef: 'sample-audio.webm',
  ownerId: 'demo-student',
};

describe('MockTranscriptionProvider', () => {
  it('returns deterministic segments for the same audio reference', async () => {
    const provider = new MockTranscriptionProvider();
    const first = await provider.transcribe(job);
    const second = await provider.transcribe(job);
    expect(first.segments).toEqual(second.segments);
    expect(first.segments.length).toBeGreaterThan(0);
    expect(first.segments[0].timestampStart).toBe(0);
  });
});

describe('TranscriptionJobProcessor', () => {
  it('saves segments, marks transcribed and queues AI analysis', async () => {
    const events: string[] = [];
    const handlers: ProcessorHandlers = {
      saveSegments: () => events.push('save'),
      markLectureTranscribed: () => events.push('transcribed'),
      queueAiAnalysis: () => events.push('ai'),
      log: () => undefined,
      onDeadLetter: () => events.push('dead'),
    };
    const processor = new TranscriptionJobProcessor(
      new MockTranscriptionProvider(),
      new MockAudioStore(),
      handlers,
    );
    const outcome = await processor.process(job);
    expect(outcome.status).toBe('SUCCEEDED');
    expect(events).toEqual(['save', 'transcribed', 'ai']);
  });

  it('is idempotent for repeated job ids', async () => {
    const processor = new TranscriptionJobProcessor(
      new MockTranscriptionProvider(),
      new MockAudioStore(),
      { saveSegments() {}, markLectureTranscribed() {}, queueAiAnalysis() {}, log() {}, onDeadLetter() {} },
    );
    await processor.process(job);
    const second = await processor.process(job);
    expect(second.retryCount).toBe(0);
  });
});
