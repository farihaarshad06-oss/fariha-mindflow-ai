export const LECTURE_STATES = [
  'DRAFT',
  'RECORDING',
  'UPLOADING',
  'UPLOADED',
  'QUEUED',
  'TRANSCRIBING',
  'TRANSCRIBED',
  'ANALYZING',
  'READY',
  'FAILED',
  'DELETED',
] as const;

export type LectureState = (typeof LECTURE_STATES)[number];

export function isLectureState(value: unknown): value is LectureState {
  return typeof value === 'string' && (LECTURE_STATES as readonly string[]).includes(value);
}

export const PROCESSING_JOB_STATES = [
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'DEAD_LETTERED',
] as const;

export type ProcessingJobState = (typeof PROCESSING_JOB_STATES)[number];

export function isProcessingJobState(value: unknown): value is ProcessingJobState {
  return (
    typeof value === 'string' && (PROCESSING_JOB_STATES as readonly string[]).includes(value)
  );
}

export const JOB_TYPES = [
  'TRANSCRIPTION',
  'LECTURE_SUMMARY',
  'KEY_CONCEPT_EXTRACTION',
  'FLASHCARD_GENERATION',
  'EMBEDDING_GENERATION',
] as const;

export type JobType = (typeof JOB_TYPES)[number];
