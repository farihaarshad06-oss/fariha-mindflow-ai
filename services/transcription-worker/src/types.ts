export interface TranscriptSegment {
  index: number;
  speaker?: string;
  text: string;
  timestampStart: number;
  timestampEnd: number;
}

export interface TranscriptionResult {
  language: string;
  durationSeconds: number;
  segments: TranscriptSegment[];
}

export interface TranscriptionJobInput {
  jobId: string;
  lectureId: string;
  audioRef: string;
  ownerId: string;
}

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(job: TranscriptionJobInput): Promise<TranscriptionResult>;
}
