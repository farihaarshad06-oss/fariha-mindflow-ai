import type { AiJob, LlmProvider } from './types';
import type { Citation } from '@mindflow/types';
import { buildSystemPrompt, sanitizeUntrustedContent, MAX_TOKENS } from './prompt-guard';

export interface AiJobResult {
  jobType: AiJob['jobType'];
  lectureId: string;
  summary?: string;
  keyConcepts?: { label: string; description: string }[];
  flashcards?: { question: string; answer: string }[];
  embedding?: number[];
  citations: Citation[];
}

function buildCitation(job: AiJob): Citation {
  return {
    id: `cit-${job.lectureId}`,
    sourceType: 'TRANSCRIPT_SEGMENT',
    lectureId: job.lectureId,
    timestampStart: 0,
    timestampEnd: 0,
    sourceLabel: job.lectureTitle,
  };
}

export class AiJobProcessor {
  constructor(private readonly provider: LlmProvider) {}

  async process(job: AiJob): Promise<AiJobResult> {
    const transcript = sanitizeUntrustedContent(job.transcript);
    const citation = buildCitation(job);

    switch (job.jobType) {
      case 'LECTURE_SUMMARY': {
        const response = await this.provider.generate({
          system: buildSystemPrompt('Write a concise lecture summary.'),
          user: transcript,
          maxTokens: MAX_TOKENS,
        });
        return { jobType: job.jobType, lectureId: job.lectureId, summary: response.content, citations: [citation] };
      }
      case 'KEY_CONCEPT_EXTRACTION': {
        const response = await this.provider.generate({
          system: buildSystemPrompt('Extract key concepts as label: description.'),
          user: transcript,
          maxTokens: MAX_TOKENS,
        });
        const keyConcepts = response.content.split('\n').filter(Boolean).map((line) => {
          const idx = line.indexOf(':');
          return idx > 0
            ? { label: line.slice(0, idx).trim(), description: line.slice(idx + 1).trim() }
            : { label: line.trim(), description: '' };
        });
        return { jobType: job.jobType, lectureId: job.lectureId, keyConcepts, citations: [citation] };
      }
      case 'FLASHCARD_GENERATION': {
        const response = await this.provider.generate({
          system: buildSystemPrompt('Generate flashcards as Q? | A.'),
          user: transcript,
          maxTokens: MAX_TOKENS,
        });
        const flashcards = response.content
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const idx = line.indexOf('|');
            return idx > 0
              ? { question: line.slice(0, idx).trim(), answer: line.slice(idx + 1).trim() }
              : { question: line.trim(), answer: '' };
          });
        return { jobType: job.jobType, lectureId: job.lectureId, flashcards, citations: [citation] };
      }
      case 'EMBEDDING_GENERATION': {
        return {
          jobType: job.jobType,
          lectureId: job.lectureId,
          embedding: this.embed(transcript),
          citations: [citation],
        };
      }
      default:
        throw new Error(`Unknown AI job type: ${(job as AiJob).jobType}`);
    }
  }

  private embed(text: string): number[] {
    const dimension = 32;
    const vector = new Array<number>(dimension).fill(0);
    for (let i = 0; i < text.length; i += 1) {
      vector[i % dimension] += text.charCodeAt(i);
    }
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => Number((value / magnitude).toFixed(4)));
  }
}
