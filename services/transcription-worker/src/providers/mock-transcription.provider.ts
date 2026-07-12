import { createHash } from 'node:crypto';
import type { TranscriptionProvider, TranscriptionJobInput, TranscriptionResult, TranscriptSegment } from '../types';

/**
 * Deterministic mock transcription provider. For a given audio reference it
 * always returns the same transcript, which makes local development and tests
 * reproducible without any cloud credentials.
 */
export class MockTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'mock';

  async transcribe(job: TranscriptionJobInput): Promise<TranscriptionResult> {
    const seed = createHash('sha256').update(job.audioRef).digest('hex');
    const script = SCRIPTS[Number.parseInt(seed.slice(0, 2), 16) % SCRIPTS.length];
    const segments: TranscriptSegment[] = script.map((text, index) => ({
      index,
      text,
      timestampStart: index * 6,
      timestampEnd: index * 6 + 5,
    }));
    return {
      language: 'de',
      durationSeconds: segments.length * 6,
      segments,
    };
  }
}

const SCRIPTS: string[][] = [
  [
    'Willkommen zur Vorlesung über Bioethik.',
    'Wir beginnen mit den vier Prinzipien.',
    'Autonomie bedeutet, die Entscheidung der Patientin zu respektieren.',
    'Beneficence beschreibt das Handeln im besten Interesse.',
  ],
  [
    'Today we discuss data structures.',
    'A binary tree stores nodes with at most two children.',
    'Heaps are useful for priority queues.',
    'Traversal can be depth-first or breadth-first.',
  ],
  [
    'Introduction to pharmacology.',
    'Pharmacokinetics studies how the body processes drugs.',
    'Absorption, distribution, metabolism and excretion.',
    'Always verify the therapeutic window.',
  ],
];
