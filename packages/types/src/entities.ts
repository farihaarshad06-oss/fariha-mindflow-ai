import type { Role } from './roles';
import type { LectureState } from './states';

export type UUID = string;
export type ISODateString = string;

export interface User {
  id: UUID;
  email: string;
  fullName: string;
  roles: Role[];
  status: 'ACTIVE' | 'DISABLED' | 'PENDING_VERIFICATION';
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface UserProfile {
  id: UUID;
  userId: UUID;
  role: string;
  institution?: string;
  degree?: string;
  semester?: string;
  preferredLanguage: string;
  studyGoals: string[];
  consentAcknowledged: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Course {
  id: UUID;
  ownerId: UUID;
  title: string;
  description?: string;
  color?: string;
  nextExamDate?: ISODateString;
  lectureCount: number;
  weakTopics: string[];
  progress: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface TranscriptSegment {
  id: UUID;
  lectureId: UUID;
  index: number;
  speaker?: string;
  text: string;
  timestampStart: number;
  timestampEnd: number;
}

export interface LectureSummary {
  id: UUID;
  lectureId: UUID;
  content: string;
  createdAt: ISODateString;
}

export interface KeyConcept {
  id: UUID;
  lectureId: UUID;
  label: string;
  description: string;
}

export interface Flashcard {
  id: UUID;
  lectureId: UUID;
  courseId?: UUID;
  question: string;
  answer: string;
}

export interface Lecture {
  id: UUID;
  courseId?: UUID;
  ownerId: UUID;
  title: string;
  state: LectureState;
  audioFileId?: UUID;
  durationSeconds?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ProcessingJob {
  id: UUID;
  jobType: string;
  status: string;
  retryCount: number;
  maxRetries: number;
  errorCode?: string;
  safeErrorMessage?: string;
  diagnosticReference?: string;
  payload: Record<string, unknown>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  startedAt?: ISODateString;
  completedAt?: ISODateString;
}

export interface UsageEvent {
  id: UUID;
  userId: UUID;
  kind: 'TRANSCRIPTION_MINUTES' | 'AI_TOKENS' | 'STORAGE_BYTES';
  amount: number;
  recordedAt: ISODateString;
}

export interface AuditLog {
  id: UUID;
  actorId?: UUID;
  actorType: 'USER' | 'SYSTEM' | 'WORKER';
  action: string;
  resource: string;
  resourceId?: UUID;
  requestId?: string;
  createdAt: ISODateString;
}

export interface ConsentRecord {
  id: UUID;
  userId: UUID;
  purpose: string;
  acknowledged: boolean;
  version: string;
  createdAt: ISODateString;
}
