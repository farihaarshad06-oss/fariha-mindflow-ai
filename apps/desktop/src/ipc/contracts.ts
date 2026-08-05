/**
 * IPC channel contracts — shared between main process and preload.
 * All handler input/output shapes are defined and validated with Zod.
 * The preload bridge exposes ONLY the functions listed in ElectronAPI.
 */

import { z } from 'zod';
import path from 'node:path';

// ── Channel names ──────────────────────────────────────────────────────────

export const IPC = {
  // App
  APP_VERSION: 'app:getVersion',
  APP_PLATFORM: 'app:getPlatform',
  APP_PATHS: 'app:getPaths',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Secrets (safeStorage)
  SECRET_SET: 'secret:set',
  SECRET_GET: 'secret:get',
  SECRET_DELETE: 'secret:delete',
  SECRET_HAS: 'secret:has',

  // Audio / Recording
  AUDIO_SAVE: 'audio:save',
  AUDIO_LIST: 'audio:list',
  AUDIO_DELETE: 'audio:delete',
  AUDIO_OPEN_DIALOG: 'audio:openDialog',

  // Recording sessions
  RECORDING_START: 'recording:start',
  RECORDING_PAUSE: 'recording:pause',
  RECORDING_RESUME: 'recording:resume',
  RECORDING_STOP: 'recording:stop',
  RECORDING_CANCEL: 'recording:cancel',
  RECORDING_GET_ACTIVE: 'recording:getActive',
  RECORDING_CHUNK_SAVE: 'recording:chunkSave',
  RECORDING_GET_MICROPHONES: 'recording:getMicrophones',
  RECORDING_CHECK_DISK: 'recording:checkDisk',

  // Courses
  COURSE_LIST: 'course:list',
  COURSE_GET: 'course:get',
  COURSE_CREATE: 'course:create',
  COURSE_UPDATE: 'course:update',
  COURSE_DELETE: 'course:delete',

  // Lectures
  LECTURE_LIST: 'lecture:list',
  LECTURE_GET: 'lecture:get',
  LECTURE_CREATE: 'lecture:create',
  LECTURE_UPDATE: 'lecture:update',
  LECTURE_DELETE: 'lecture:delete',

  // Transcription
  TRANSCRIPT_LIST: 'transcript:list',
  TRANSCRIPT_EDIT_SEGMENT: 'transcript:editSegment',

  // Whisper model manager
  MODEL_LIST: 'model:list',
  MODEL_DOWNLOAD_START: 'model:downloadStart',
  MODEL_DOWNLOAD_CANCEL: 'model:downloadCancel',
  MODEL_DELETE: 'model:delete',
  MODEL_GET_ACTIVE: 'model:getActive',

  // Jobs
  JOB_LIST: 'job:list',
  JOB_CANCEL: 'job:cancel',
  JOB_RETRY: 'job:retry',

  // AI providers
  PROVIDER_LIST: 'provider:list',
  PROVIDER_UPSERT: 'provider:upsert',
  PROVIDER_DELETE: 'provider:delete',
  PROVIDER_TEST: 'provider:test',

  // Usage
  USAGE_SUMMARY: 'usage:summary',
  USAGE_RESET: 'usage:reset',

  // Summaries / flashcards / chat
  SUMMARY_GET: 'summary:get',
  FLASHCARD_LIST: 'flashcard:list',
  FLASHCARD_REVIEW: 'flashcard:review',
  CHAT_SEND: 'chat:send',
  CHAT_HISTORY: 'chat:history',

  // Quiz
  QUIZ_LIST: 'quiz:list',
  QUIZ_GET: 'quiz:get',
  QUIZ_SUBMIT: 'quiz:submit',

  // Backup / restore / export
  BACKUP_CREATE: 'backup:create',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_LIST: 'backup:list',
  EXPORT_DATA: 'export:data',
  DIAGNOSTICS_GET: 'diagnostics:get',

  // Live streaming transcription
  RECORDING_CHUNK_TRANSCRIBE_NOW: 'recording:chunkTranscribeNow',
  TRANSCRIPT_LIVE: 'transcript:live',

  // Whisper transcription trigger
  WHISPER_TRANSCRIBE_NOW: 'whisper:transcribeNow',

  // Flashcard generation
  FLASHCARD_GENERATE: 'flashcard:generate',

  // Quiz generation
  QUIZ_GENERATE: 'quiz:generate',

  // Study plan
  STUDY_PLAN_GET: 'studyplan:get',

  // Weakness analysis
  WEAKNESS_ANALYZE: 'weakness:analyze',
} as const;

// ── Zod schemas for IPC payloads ───────────────────────────────────────────

export const RecordingStartSchema = z.object({
  lectureId: z.string().cuid(),
  microphoneId: z.string().optional(),
  privacyMode: z.boolean().default(false),
  language: z.string().length(2).default('en'),
});

export const RecordingChunkSaveSchema = z.object({
  sessionId: z.string().cuid(),
  lectureId: z.string().cuid(),
  index: z.number().int().min(0),
  arrayBuffer: z.instanceof(ArrayBuffer).or(z.instanceof(Uint8Array)),
  durationMs: z.number().int().min(0),
  startOffsetMs: z.number().int().min(0),
});

export const LiveChunkTranscribeSchema = z.object({
  sessionId: z.string().cuid(),
  chunkId: z.string().cuid(),
  lectureId: z.string().cuid(),
  startOffsetMs: z.number().int().min(0),
  language: z.string().length(2).default('en'),
});

export const SecretSetSchema = z.object({
  key: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid key format'),
  value: z.string().min(1),
});

export const SettingsSetSchema = z.object({
  preferredLanguage: z.string().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  audioRetentionDays: z.number().int().min(1).max(3650).optional(),
  recordingConsentGiven: z.boolean().optional(),
  onboardingComplete: z.boolean().optional(),
  storagePath: z.string().optional(),
  whisperModelId: z.string().optional(),
  defaultAiProvider: z.string().optional(),
  aiMode: z.enum(['local', 'cloud', 'hybrid']).optional(),
  dailyTokenLimit: z.number().int().min(0).optional(),
  monthlyTokenLimit: z.number().int().min(0).optional(),
  dailyCostLimitCents: z.number().int().min(0).optional(),
  monthlyCostLimitCents: z.number().int().min(0).optional(),
  quizDayOfWeek: z.number().int().min(0).max(6).optional(),
  privacyModeDefault: z.boolean().optional(),
});

export const CourseCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  nextExamDate: z.string().datetime().optional(),
});

export const LectureCreateSchema = z.object({
  courseId: z.string().cuid().optional(),
  title: z.string().min(1).max(255),
  language: z.string().length(2).default('en'),
});

export const TranscriptEditSchema = z.object({
  segmentId: z.string().cuid(),
  editedText: z.string().min(0).max(10000),
});

export const ModelDownloadStartSchema = z.object({
  modelId: z.enum(['tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3']),
});

export const ProviderUpsertSchema = z.object({
  id: z.string().optional(),
  providerType: z.enum(['openai', 'azure', 'gemini', 'ollama', 'lmstudio', 'openai-compat']),
  displayName: z.string().min(1).max(128),
  enabled: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  baseUrl: z.string().url().optional().or(z.literal('')),
  modelRouting: z.object({
    economy: z.string().optional(),
    balanced: z.string().optional(),
    quality: z.string().optional(),
  }).optional(),
  // secret is handled separately via SECRET_SET
});

export const FlashcardReviewSchema = z.object({
  flashcardId: z.string().cuid(),
  quality: z.number().int().min(0).max(5),
});

export const ChatSendSchema = z.object({
  courseId: z.string().cuid().optional(),
  message: z.string().min(1).max(4000),
});

export const QuizSubmitSchema = z.object({
  attemptId: z.string().cuid(),
  answers: z.array(z.object({
    questionId: z.string().cuid(),
    answer: z.string().min(0).max(5000),
  })),
});

// ── Generic response envelope ─────────────────────────────────────────────

export interface IpcOk<T = undefined> {
  ok: true;
  data: T;
}

export interface IpcErr {
  ok: false;
  error: string;
  code?: string;
}

export type IpcResult<T = undefined> = IpcOk<T> | IpcErr;

export function ok<T>(data: T): IpcOk<T> {
  return { ok: true, data };
}

export function err(error: string, code?: string): IpcErr {
  return { ok: false, error, code };
}

// ── Path safety ───────────────────────────────────────────────────────────

/**
 * Validate that `filePath` is inside `rootDir`.
 * Throws if the resolved path escapes the root (path traversal prevention).
 */
export function assertSafePath(filePath: string, rootDir: string): string {
  const { resolve, sep } = path;
  const resolved = resolve(filePath);
  const root = resolve(rootDir) + sep;
  if (!resolved.startsWith(root) && resolved !== resolve(rootDir)) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }
  return resolved;
}
