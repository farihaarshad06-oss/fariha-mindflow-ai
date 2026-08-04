import { contextBridge, ipcRenderer } from 'electron';
import type { IpcResult } from './ipc/contracts';

/**
 * Exposes a minimal, type-safe IPC bridge to the renderer process.
 *
 * SECURITY:
 * - contextIsolation: true — renderer cannot access Node.js or Electron directly
 * - nodeIntegration: false — no require() in renderer
 * - Only explicitly allow-listed channels are bridgeable
 * - Full secrets are NEVER included in responses
 * - All inputs validated in main-process handlers before reaching services
 */

function invoke(channel: string, ...args: unknown[]): Promise<IpcResult<unknown>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<unknown>>;
}

function on(channel: string, listener: (...args: unknown[]) => void): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

contextBridge.exposeInMainWorld('electronAPI', {
  // ── App ────────────────────────────────────────────────────────────
  getVersion: () => invoke('app:getVersion'),
  getPlatform: () => invoke('app:getPlatform'),
  getPaths: () => invoke('app:getPaths'),
  isDesktop: true,

  // ── Settings ───────────────────────────────────────────────────────
  getSettings: () => invoke('settings:get'),
  updateSettings: (data: unknown) => invoke('settings:set', data),

  // ── Secrets (write/check/delete only — never read) ─────────────────
  setSecret: (key: string, value: string) => invoke('secret:set', { key, value }),
  hasSecret: (key: string) => invoke('secret:has', key),
  deleteSecret: (key: string) => invoke('secret:delete', key),

  // ── Audio (legacy direct-file) ─────────────────────────────────────
  saveAudio: (fileName: string, arrayBuffer: ArrayBuffer) =>
    invoke('audio:save', fileName, arrayBuffer),
  listAudio: () => invoke('audio:list'),
  deleteAudio: (fileName: string) => invoke('audio:delete', fileName),

  // ── Recording sessions ─────────────────────────────────────────────
  startRecording: (opts: unknown) => invoke('recording:start', opts),
  pauseRecording: (sessionId: string) => invoke('recording:pause', sessionId),
  resumeRecording: (sessionId: string) => invoke('recording:resume', sessionId),
  stopRecording: (sessionId: string) => invoke('recording:stop', sessionId),
  getActiveRecording: (lectureId: string) => invoke('recording:getActive', lectureId),
  saveAudioChunk: (opts: unknown) => invoke('recording:chunkSave', opts),
  checkDiskSpace: () => invoke('recording:checkDisk'),

  // ── Courses ────────────────────────────────────────────────────────
  listCourses: () => invoke('course:list'),
  getCourse: (id: string) => invoke('course:get', id),
  createCourse: (data: unknown) => invoke('course:create', data),
  updateCourse: (id: string, data: unknown) => invoke('course:update', id, data),
  deleteCourse: (id: string) => invoke('course:delete', id),

  // ── Lectures ───────────────────────────────────────────────────────
  listLectures: (courseId?: string) => invoke('lecture:list', courseId),
  getLecture: (id: string) => invoke('lecture:get', id),
  createLecture: (data: unknown) => invoke('lecture:create', data),
  updateLecture: (id: string, data: unknown) => invoke('lecture:update', id, data),
  deleteLecture: (id: string) => invoke('lecture:delete', id),

  // ── Transcripts ────────────────────────────────────────────────────
  listTranscript: (lectureId: string) => invoke('transcript:list', lectureId),
  editTranscriptSegment: (data: unknown) => invoke('transcript:editSegment', data),

  // ── Whisper models ─────────────────────────────────────────────────
  listModels: () => invoke('model:list'),
  downloadModel: (data: unknown) => invoke('model:downloadStart', data),
  cancelDownload: (modelId: string) => invoke('model:downloadCancel', modelId),
  deleteModel: (modelId: string) => invoke('model:delete', modelId),

  // ── Jobs ───────────────────────────────────────────────────────────
  listJobs: (filter?: unknown) => invoke('job:list', filter),
  cancelJob: (jobId: string) => invoke('job:cancel', jobId),

  // ── AI Providers ───────────────────────────────────────────────────
  listProviders: () => invoke('provider:list'),
  upsertProvider: (data: unknown) => invoke('provider:upsert', data),
  deleteProvider: (id: string) => invoke('provider:delete', id),
  testProvider: (id: string) => invoke('provider:test', id),

  // ── Usage ──────────────────────────────────────────────────────────
  getUsageSummary: (opts?: unknown) => invoke('usage:summary', opts),

  // ── Flashcards ─────────────────────────────────────────────────────
  listFlashcards: (courseId?: string) => invoke('flashcard:list', courseId),
  reviewFlashcard: (data: unknown) => invoke('flashcard:review', data),

  // ── Chat ───────────────────────────────────────────────────────────
  getChatHistory: (courseId?: string) => invoke('chat:history', courseId),
  sendChatMessage: (data: unknown) => invoke('chat:send', data),

  // ── Quiz ───────────────────────────────────────────────────────────
  listQuizzes: (courseId?: string) => invoke('quiz:list', courseId),
  submitQuiz: (data: unknown) => invoke('quiz:submit', data),

  // ── Backup & diagnostics ───────────────────────────────────────────
  getDiagnostics: () => invoke('diagnostics:get'),

  // ── Push events from main → renderer ──────────────────────────────
  /** Subscribe to model download progress events. Returns an unsubscribe fn. */
  onModelDownloadProgress: (
    listener: (data: { modelId: string; downloaded: number; total: number }) => void
  ) => on('model:downloadProgress', listener as (...args: unknown[]) => void),

  /** Subscribe to recording error events (disk full, mic disconnect, etc). */
  onRecordingError: (
    listener: (data: { sessionId: string; code: string; message: string }) => void
  ) => on('recording:error', listener as (...args: unknown[]) => void),
} satisfies Record<string, unknown>);
