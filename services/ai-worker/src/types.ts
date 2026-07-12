export type AiJobType =
  | 'LECTURE_SUMMARY'
  | 'KEY_CONCEPT_EXTRACTION'
  | 'FLASHCARD_GENERATION'
  | 'EMBEDDING_GENERATION';

export interface AiJob {
  jobId: string;
  lectureId: string;
  jobType: AiJobType;
  transcript: string;
  lectureTitle: string;
}

export interface LlmRequest {
  system: string;
  user: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface LlmResponse {
  content: string;
  model: string;
  finishReason: 'stop' | 'length' | 'error';
}

export interface LlmProvider {
  readonly name: string;
  generate(request: LlmRequest): Promise<LlmResponse>;
}
